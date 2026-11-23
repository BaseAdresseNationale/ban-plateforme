import { constants } from 'node:fs'
import type { BigIntStats } from 'node:fs'
import { open } from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pathToFileURL } from 'node:url'

import { importPostalReferences } from './reference-import.js'
import { PostalReferenceError } from './reference-writer.js'
import type { ReferencePool } from './reference-writer.js'

const usage = `Usage: pnpm --filter @ban/postal-code run import:references
  --datanova <local.csv> --areas <local.geojson> --source-srid <2154|4326>
  --expect-database <database> [--delimiter <;|,>] [--apply]
PG_URL must explicitly select the expected database and user. No .env is loaded.
Default: validate both files in temporary tables and roll back. --apply replaces both references.
`

class ArgumentsError extends Error {}

export function parseImportArguments(argv: readonly string[]) {
  const args = argv[0] === '--' ? argv.slice(1) : argv
  if (args.length === 1 && args[0] === '--help') return { help: true as const }
  const values = new Map<string, string>()
  let apply = false
  const allowed = ['--datanova', '--areas', '--source-srid', '--expect-database', '--delimiter']
  if (args.length > 12) throw new ArgumentsError('Too many import arguments')
  for (let index = 0; index < args.length; index++) {
    const key = args[index]
    if (key === '--apply') {
      if (apply) throw new ArgumentsError('Duplicate import option')
      apply = true
    } else {
      if (!allowed.includes(key) || values.has(key)) {
        throw new ArgumentsError('Unknown or duplicate import option')
      }
      const value = args[++index]
      if (!value || value.startsWith('--') || value.length > 16_384
        || /[\u0000\r\n]/u.test(value)) {
        throw new ArgumentsError('Missing or invalid import option value')
      }
      values.set(key, value)
    }
  }
  if (['--datanova', '--areas', '--source-srid', '--expect-database']
    .some(key => !values.has(key))) throw new ArgumentsError('Missing required import options')
  const srid = values.get('--source-srid')
  const delimiter = values.get('--delimiter') ?? ';'
  if (!['2154', '4326'].includes(srid!) || ![';', ','].includes(delimiter)) {
    throw new ArgumentsError('Unsupported source projection or CSV delimiter')
  }
  const datanova = values.get('--datanova')!
  const areas = values.get('--areas')!
  if ([datanova, areas].some(value => /^[a-z][a-z0-9+.-]*:\/\//i.test(value))) {
    throw new ArgumentsError('Local input files are required')
  }
  return { help: false as const, datanova, areas, apply,
    sourceSrid: Number(srid) as 2154 | 4326, delimiter: delimiter as ';' | ',',
    database: values.get('--expect-database')! }
}

interface RuntimePool extends ReferencePool {
  end(): Promise<void>
}

interface CommandDependencies {
  loadPool?: (url: string) => Promise<RuntimePool>
  importReferences?: typeof importPostalReferences
  signal?: AbortSignal
}

interface OpenedSource {
  handle: FileHandle
  before: BigIntStats
  stream: Readable
}

async function openSource(filename: string): Promise<OpenedSource> {
  let handle: FileHandle | undefined
  try {
    handle = await open(path.resolve(filename),
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
    const before = await handle.stat({ bigint: true })
    if (!before.isFile() || before.size <= 0n || before.size > 8_000_000_000n) {
      throw new ArgumentsError('Input must be a nonempty bounded regular file')
    }
    const owned = handle
    const stream = Readable.from((async function* () {
      let total = 0n
      for (;;) {
        const buffer = Buffer.allocUnsafe(64 * 1024)
        const { bytesRead } = await owned.read(buffer, 0, buffer.length, null)
        if (!bytesRead) break
        total += BigInt(bytesRead)
        yield buffer.subarray(0, bytesRead)
      }
      const after = await owned.stat({ bigint: true })
      if (total !== before.size || ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs']
        .some(key => before[key as keyof BigIntStats] !== after[key as keyof BigIntStats])) {
        throw new PostalReferenceError('invalid-reference', 'Postal source changed during import')
      }
    })(), { objectMode: false, highWaterMark: 64 * 1024 })
    return { handle, before, stream }
  } catch {
    await handle?.close()
    throw new ArgumentsError('Unable to open bounded regular input files; symlinks are refused')
  }
}

function databaseIdentity(value: string | undefined, expected: string) {
  try {
    const url = new URL(value ?? '')
    const database = decodeURIComponent(url.pathname.slice(1))
    const user = decodeURIComponent(url.username)
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !user
      || !database || database !== expected || /[\u0000\r\n]/u.test(database + user)) {
      throw new Error('Invalid destination')
    }
    return { database, user, url: value! }
  } catch {
    throw new ArgumentsError('PG_URL must match the expected database and explicitly name its user')
  }
}

async function loadRuntimePool(url: string): Promise<RuntimePool> {
  if (process.env.PG_URL !== url) {
    throw new ArgumentsError('PG_URL does not match runtime configuration')
  }
  const { pool } = await import('@ban/prisma-client')
  if (pool.options.connectionString !== url) {
    throw new ArgumentsError('Shared pool destination mismatch')
  }
  return pool
}

/** Injectable handler; main alone loads runtime dependencies and prints sanitized output. */
export async function runImportCommand(
  argv: readonly string[], env: NodeJS.ProcessEnv, dependencies: CommandDependencies = {},
) {
  const opened: OpenedSource[] = []
  let pool: RuntimePool | undefined
  let result = { exitCode: 1, output: '' }
  try {
    const options = parseImportArguments(argv)
    if (options.help) return { exitCode: 0, output: usage }
    dependencies.signal?.throwIfAborted()
    const identity = databaseIdentity(env.PG_URL, options.database)
    opened.push(await openSource(options.datanova))
    opened.push(await openSource(options.areas))
    if (opened[0].before.dev === opened[1].before.dev
      && opened[0].before.ino === opened[1].before.ino) {
      throw new ArgumentsError('Two distinct input files are required')
    }
    pool = await (dependencies.loadPool ?? loadRuntimePool)(identity.url)
    const runtime = pool
    const checkedPool: ReferencePool = {
      async connect() {
        const client = await runtime.connect()
        try {
          const { rows: [actual] } = await client.query(
            'SELECT current_database() AS database, current_user AS role',
          )
          if (actual?.database !== identity.database || actual.role !== identity.user) {
            throw new Error('Destination mismatch')
          }
          return client
        } catch {
          client.release(new Error('Discard unexpected reference destination'))
          throw new PostalReferenceError('storage', 'PostgreSQL destination verification failed')
        }
      },
    }
    const report = await (dependencies.importReferences ?? importPostalReferences)(checkedPool, {
      datanova: opened[0].stream, areas: opened[1].stream,
      sourceSrid: options.sourceSrid, delimiter: options.delimiter,
    }, { apply: options.apply, signal: dependencies.signal })
    result = { exitCode: 0, output: JSON.stringify({ status: 'success', ...report }) + '\n' }
  } catch (error) {
    const uncertain = error instanceof PostalReferenceError && error.kind === 'publication-unknown'
    const interrupted = !uncertain && dependencies.signal?.aborted
    const kind = interrupted ? 'interrupted' : error instanceof ArgumentsError ? 'arguments'
      : error instanceof PostalReferenceError ? error.kind : 'storage'
    const message = interrupted ? 'Postal import interrupted'
      : error instanceof ArgumentsError || error instanceof PostalReferenceError
        ? error.message : 'Postal import failed'
    const exitCode = interrupted ? dependencies.signal?.reason === 'SIGTERM' ? 143 : 130
      : kind === 'arguments' || kind === 'invalid-reference' ? 2
        : kind === 'publication-unknown' ? 3 : 1
    result = { exitCode, output: JSON.stringify({ status: 'error', kind, message,
      ...(uncertain && dependencies.signal?.aborted ? { interrupted: true } : {}),
    }) + '\n' }
  } finally {
    for (const input of opened) input.stream.destroy()
    const cleanup = await Promise.allSettled([
      ...opened.map(input => input.handle.close()), ...(pool ? [pool.end()] : []),
    ])
    if (cleanup.some(item => item.status === 'rejected')) {
      const primary = JSON.parse(result.output) as Record<string, unknown>
      result = result.exitCode !== 0
        ? { ...result, output: JSON.stringify({ ...primary, cleanupFailed: true }) + '\n' }
        : { exitCode: 1, output: JSON.stringify({ status: 'error', kind: 'cleanup',
          message: 'Import completed but resource cleanup failed', applied: primary.applied,
        }) + '\n' }
    }
  }
  return result
}

async function main() {
  const controller = new AbortController()
  const interrupt = () => controller.abort('SIGINT')
  const terminate = () => controller.abort('SIGTERM')
  process.once('SIGINT', interrupt)
  process.once('SIGTERM', terminate)
  try {
    const result = await runImportCommand(process.argv.slice(2), process.env,
      { signal: controller.signal })
    const output = result.exitCode === 0 ? process.stdout : process.stderr
    output.write(result.output)
    process.exitCode = result.exitCode
  } finally {
    process.removeListener('SIGINT', interrupt)
    process.removeListener('SIGTERM', terminate)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  void main().catch(() => {
    console.error('Postal import failed')
    process.exitCode = 1
  })
}
