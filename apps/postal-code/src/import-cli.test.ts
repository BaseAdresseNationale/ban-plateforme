import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { parseImportArguments, runImportCommand } from './import-cli.js'
import type { importPostalReferences } from './reference-import.js'

const folders = new Set<string>()
const csv = 'code_commune_insee;code_postal;libelle_d_acheminement\n96001;96001;FICTIF\n'
const geo = JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature',
  properties: { cp: '96001', insee_com: '96001' }, geometry: { type: 'Polygon',
    coordinates: [[[0,0],[2,0],[2,2],[0,0]]] } }] })
const database = 'ban_postal_cli_unit'
const env = { PG_URL: 'postgresql://cli_test:fake@127.0.0.1:1/' + database }

async function fixture() {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'ban-postal-cli-unit-'))
  folders.add(folder)
  const datanova = path.join(folder, 'datanova.csv')
  const areas = path.join(folder, 'areas.geojson')
  await writeFile(datanova, csv)
  await writeFile(areas, geo)
  const args = ['--datanova', datanova, '--areas', areas,
    '--source-srid', '2154', '--expect-database', database]
  return { folder, datanova, areas, args }
}

function runtime() {
  const query = vi.fn(async (sql: string, _values?: unknown[]):
  Promise<{ rows: Record<string, unknown>[] }> => ({ rows:
    sql.includes('current_database()') ? [{ database, role: 'cli_test' }]
      : sql.includes('AS inconsistent') ? [{ communes: 1, codes: 1, areas: 1, inconsistent: false }]
        : sql.includes('RETURNING 1') ? [{ accepted: 1 }] : [],
  }))
  const release = vi.fn()
  const end = vi.fn(async () => {})
  const loadPool = vi.fn(async () => ({ connect: async () => ({ query, release }), end }))
  return { query, release, end, loadPool }
}

afterEach(async () => {
  for (const folder of folders) {
    if (path.dirname(folder) !== os.tmpdir()
      || !path.basename(folder).startsWith('ban-postal-cli-unit-')) throw new Error('Unsafe cleanup')
    await rm(folder, { recursive: true, force: true })
    folders.delete(folder)
  }
})

describe('postal import command', () => {
  it('shows help without environment, files, pool or sockets', async () => {
    const db = runtime()
    const result = await runImportCommand(['--help'], {}, db)
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('--expect-database')
    expect(db.loadPool).not.toHaveBeenCalled()
  })

  it.each([
    [], ['--apply'], ['--unknown', 'value'], ['--datanova'],
    ['--datanova','a','--datanova','b'], ['--apply','--apply'],
    ['--datanova','a','--areas','b','--source-srid','9999','--expect-database','fake'],
    ['--datanova','https://example.test/file','--areas','b',
      '--source-srid','2154','--expect-database','fake'],
    ['--datanova','a','--areas','b','--source-srid','2154',
      '--expect-database','fake','--delimiter','|'],
  ].map(args => ({ args })))('rejects missing, duplicate, remote or unknown arguments %#', ({ args }) => {
    expect(() => parseImportArguments(args)).toThrow()
  })

  it('validates identity and imports in simulation without any HTTP token', async () => {
    const files = await fixture()
    const db = runtime()
    const result = await runImportCommand(files.args, env, db)
    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.output)).toMatchObject({ status: 'success', applied: false,
      communes: 1, codes: 1, areas: 1, sources: { datanova: { records: 1 } } })
    expect(db.query.mock.calls[0][0]).toBe('SELECT current_database() AS database, current_user AS role')
    expect(db.query.mock.calls.some(([sql]) => sql.includes('DELETE FROM postal.'))).toBe(false)
    expect(db.end).toHaveBeenCalledTimes(1)
    expect(result.output).not.toContain(files.folder)
    expect(result.output).not.toContain(env.PG_URL)
  })

  it('only publishes with --apply and accepts the pnpm argument separator', async () => {
    const files = await fixture()
    const db = runtime()
    const result = await runImportCommand(['--', ...files.args, '--apply'], env, db)
    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.output)).toMatchObject({ status: 'success', applied: true })
    expect(db.query.mock.calls.some(([sql]) => sql.includes('DELETE FROM postal.'))).toBe(true)
    expect(db.query.mock.calls.at(-1)?.[0]).toBe('COMMIT')
  })

  it.each([{}, { PG_URL: 'https://example.test/ban' },
    { PG_URL: 'postgresql://cli_test:fake@127.0.0.1:1/other' },
    { PG_URL: 'postgresql://127.0.0.1:1/' + database },
  ])('rejects mismatching configuration before loading a pool %#', async configuration => {
    const files = await fixture()
    const db = runtime()
    const result = await runImportCommand(files.args, configuration, db)
    expect(result.exitCode).toBe(2)
    expect(db.loadPool).not.toHaveBeenCalled()
    expect(result.output).not.toContain('postgresql://')
  })

  it.each(['database', 'role'])('checks actual PostgreSQL %s before any transaction', async field => {
    const files = await fixture()
    const db = runtime()
    db.query.mockResolvedValue({ rows: [{ database, role: 'cli_test', [field]: 'unexpected' }] })
    const result = await runImportCommand(files.args, env, db)
    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.output).kind).toBe('storage')
    expect(db.query).toHaveBeenCalledTimes(1)
    expect(db.release).toHaveBeenCalledWith(expect.any(Error))
    expect(db.end).toHaveBeenCalledTimes(1)
  })

  it.each(['missing', 'empty', 'directory', 'symlink', 'same-file'])(
    'refuses %s input before any database access', async kind => {
      const files = await fixture()
      const db = runtime()
      let filename = files.datanova
      if (kind === 'missing') filename = path.join(files.folder, 'missing.csv')
      if (kind === 'empty') await writeFile(filename, '')
      if (kind === 'directory') {
        filename = path.join(files.folder, 'directory'); await mkdir(filename)
      }
      if (kind === 'symlink') {
        filename = path.join(files.folder, 'link.csv'); await symlink(files.datanova, filename)
      }
      const args = files.args.map((arg, index) => index === 1 ? filename : arg)
      if (kind === 'same-file') args[3] = filename
      const result = await runImportCommand(args, env, db)
      expect(result.exitCode).toBe(2)
      expect(db.loadPool).not.toHaveBeenCalled()
      expect(result.output).not.toContain(files.folder)
    },
  )

  it('refuses files changed while being read', async () => {
    const files = await fixture()
    await writeFile(files.datanova, 'A'.repeat(300_000))
    const db = runtime()
    const importer: typeof importPostalReferences = async (_pool, input) => {
      const reader = input.datanova[Symbol.asyncIterator]()
      await reader.next()
      await writeFile(files.datanova, 'REPLACED SYNTHETIC FILE')
      while (!(await reader.next()).done) { /* consume the checked descriptor */ }
      throw new Error('Expected source mutation failure')
    }
    const result = await runImportCommand(files.args, env, { ...db, importReferences: importer })
    expect(result.exitCode).toBe(2)
    expect(JSON.parse(result.output).message).toBe('Postal source changed during import')
    expect(db.end).toHaveBeenCalledTimes(1)
  })

  it('preserves storage and uncertain-commit diagnoses without raw details', async () => {
    const files = await fixture()
    for (const commit of [false, true]) {
      const db = runtime()
      const implementation = db.query.getMockImplementation()!
      db.query.mockImplementation(async (sql, values) => {
        if (commit ? sql === 'COMMIT' : sql.includes('RETURNING 1')) {
          throw new Error('private database and password')
        }
        return implementation(sql, values)
      })
      const result = await runImportCommand([...files.args, '--apply'], env, db)
      expect(result.exitCode).toBe(commit ? 3 : 1)
      expect(JSON.parse(result.output)).toMatchObject({ status: 'error',
        kind: commit ? 'publication-unknown' : 'storage' })
      expect(result.output).not.toContain('password')
      expect(db.end).toHaveBeenCalledTimes(1)
    }
  })

  it('does not hide a pool cleanup failure behind a successful report', async () => {
    const files = await fixture()
    const db = runtime()
    db.end.mockRejectedValue(new Error('private close detail'))
    const result = await runImportCommand(files.args, env, db)
    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.output).kind).toBe('cleanup')
    expect(result.output).not.toContain('private close detail')
  })

  it.each(['interrupt', 'cleanup', 'both'])(
    'keeps COMMIT uncertainty primary when combined with %s', async scenario => {
      const files = await fixture()
      const db = runtime()
      const controller = new AbortController()
      const implementation = db.query.getMockImplementation()!
      db.query.mockImplementation(async (sql, values) => {
        if (sql === 'COMMIT') {
          if (scenario !== 'cleanup') controller.abort('SIGINT')
          throw new Error('private connection detail')
        }
        return implementation(sql, values)
      })
      if (scenario !== 'interrupt') db.end.mockRejectedValue(new Error('private cleanup detail'))
      const result = await runImportCommand([...files.args, '--apply'], env,
        { ...db, signal: controller.signal })
      expect(result.exitCode).toBe(3)
      const report = JSON.parse(result.output)
      expect(report).toMatchObject({ status: 'error', kind: 'publication-unknown' })
      if (scenario !== 'cleanup') expect(report.interrupted).toBe(true)
      if (scenario !== 'interrupt') expect(report.cleanupFailed).toBe(true)
      expect(result.output).not.toContain('private')
    },
  )

  it('honors cancellation before opening inputs or loading the runtime', async () => {
    const files = await fixture()
    const db = runtime()
    const result = await runImportCommand(files.args, env,
      { ...db, signal: AbortSignal.abort('SIGINT') })
    expect(result.exitCode).toBe(130)
    expect(db.loadPool).not.toHaveBeenCalled()
    expect(await readFile(files.datanova, 'utf8')).toBe(csv)
  })
})
