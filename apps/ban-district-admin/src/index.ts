import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { parseCommand, runCommand } from './command.js'
import { createDistrictRepository } from './repository.js'

export function validateDatabaseUrl(value: string | undefined) {
  try {
    const url = new URL(value ?? '')
    if (!['postgres:', 'postgresql:'].includes(url.protocol)
      || !url.hostname || url.pathname.length < 2) throw new Error()
  } catch {
    throw new Error('A valid PostgreSQL PG_URL is required')
  }
}

async function main() {
  const command = parseCommand(process.argv.slice(2))
  validateDatabaseUrl(process.env.PG_URL)
  // Le point d'entrée explicite réutilise le pool existant, sans charger de .env.
  const { pool } = await import('@ban/prisma-client')
  pool.options.connectionTimeoutMillis ??= 5000
  try {
    const result = await runCommand(command, { repository: createDistrictRepository(pool) })
    console.log(JSON.stringify(result))
    if (result.status !== 'updated' && result.status !== 'unchanged') process.exitCode = 1
  } finally {
    await pool.end()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error(JSON.stringify({ status: 'failed', reason: 'invalid-command-or-configuration' }))
    process.exitCode = 1
  })
}
