import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { createPostalApp } from './app.js'
import { loadPostalConfig } from './config.js'
import { createPostalLookup } from './lookup.js'
import { createPostalRepository } from './repository.js'

async function main() {
  const config = loadPostalConfig(process.env)
  // Seul le point d'entrée réseau charge le pool existant ; aucun .env personnel.
  const { pool } = await import('@ban/prisma-client')
  const app = createPostalApp({
    tokens: config.tokens,
    lookup: createPostalLookup(createPostalRepository(pool)),
  })
  const server = app.listen(config.port, config.host, () => {
    const address = server.address()
    if (address && typeof address !== 'string') {
      console.log(`[postal-code] HTTP ${config.host}:${address.port}`)
    }
  })
  server.on('error', () => {
    console.error('[postal-code] Unable to start HTTP listener')
    void pool.end()
    process.exitCode = 1
  })
  const stop = () => {
    server.close(() => { void pool.end() })
    server.closeAllConnections()
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error('[postal-code] Invalid configuration or startup failure')
    process.exitCode = 1
  })
}
