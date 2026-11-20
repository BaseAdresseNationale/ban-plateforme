/** Intégration transversale : migration, requêtes spatiales et résolution ensemble.
 * Le test crée sa propre base ; aucune URL utilisateur n'est acceptée.
 */
import { execFileSync, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createPostalLookup } from './lookup.js'
import { createPostalRepository } from './repository.js'

const enabled = process.env.RUN_POSTAL_POSTGRES_TESTS === '1'
const image = 'postgis/postgis:17-3.4'
const suffix = randomBytes(6).toString('hex')
const name = `ban-postal-http-test-${suffix}`
const database = `ban_postal_http_${suffix}`
const label = `postal-http-${suffix}`
let containerId: string | undefined
let pool: Pool | undefined
let testPort: number | undefined
const run = (...args: string[]) => execFileSync('docker', args, {
  encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'],
}).trim()

function inspectOwnedIdentity() {
  if (!containerId) throw new Error('No owned postal container')
  const [state] = JSON.parse(run('inspect', containerId))
  expect(state.Id).toBe(containerId)
  expect(state.Name).toBe(`/${name}`)
  expect(state.Config.Labels['ban.postal.http-test']).toBe(label)
  expect(state.Config.Image).toBe(image)
  expect(state.HostConfig.Tmpfs['/var/lib/postgresql/data']).toBeDefined()
  expect(state.Mounts.every((mount: { Type: string }) => mount.Type !== 'volume')).toBe(true)
  return state
}

function inspectOwnedPort() {
  const state = inspectOwnedIdentity()
  const ports = state.NetworkSettings.Ports['5432/tcp']
  expect(ports).toHaveLength(1)
  expect(ports[0].HostIp).toBe('127.0.0.1')
  if (testPort !== undefined) expect(Number(ports[0].HostPort)).toBe(testPort)
  return Number(ports[0].HostPort)
}

async function verifyDatabase() {
  inspectOwnedPort()
  const { rows: [identity] } = await pool!.query(
    'SELECT current_database() AS db, current_user AS role',
  )
  expect(identity).toEqual({ db: database, role: 'postal_test' })
}

describe.skipIf(!enabled)('owned disposable PostGIS postal service', () => {
  beforeAll(async () => {
    const endpoint = run('context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}')
    expect(JSON.parse(endpoint)).toMatch(/^unix:\/\//)
    if (process.env.DOCKER_HOST) expect(process.env.DOCKER_HOST).toMatch(/^unix:\/\//)
    run('image', 'inspect', image)
    containerId = run('run', '--detach', '--pull=never', '--name', name,
      '--label', `ban.postal.http-test=${label}`,
      '--publish', '127.0.0.1::5432', '--tmpfs', '/var/lib/postgresql/data',
      '--env', `POSTGRES_DB=${database}`, '--env', 'POSTGRES_USER=postal_test',
      '--env', 'POSTGRES_PASSWORD=postal-test-only', image)
    expect(containerId).toMatch(/^[a-f0-9]{64}$/)
    testPort = inspectOwnedPort()
    expect(testPort).toBeGreaterThan(0)
    pool = new Pool({ host: '127.0.0.1', port: testPort, database, user: 'postal_test',
      password: 'postal-test-only', connectionTimeoutMillis: 1000, max: 2 })
    let ready = false
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) {
      try { await pool.query('SELECT 1'); ready = true; break } catch { await delay(100) }
    }
    expect(ready, 'Dedicated PostGIS did not become ready').toBe(true)
    await verifyDatabase()
    const migration = new URL(
      '../../../packages/prisma-client/prisma/migrations/0012_postal_reference/migration.sql',
      import.meta.url,
    )
    await pool.query(readFileSync(migration, 'utf8'))
    await verifyDatabase()
    await pool.query(`INSERT INTO postal.datanova
      ("inseeCom", "postalCodes", "libelleAcheminementWithPostalCodes") VALUES
      ('96001', ARRAY['96002','96001'],
        '{"96001":"SECTEUR FICTIF A","96002":"SECTEUR FICTIF B"}'),
      ('96002', ARRAY['96003'], '{"96003":"COMMUNE FICTIVE"}'),
      ('96003', ARRAY['96004','96005'], '{"96004":"AMBIGU A","96005":"AMBIGU B"}'),
      ('96004', ARRAY['96006'], '{"96006":42}')`)
    await pool.query(`WITH center AS (
      SELECT ST_Transform(ST_SetSRID(ST_MakePoint(2,46),4326),2154) AS p
    ), mono AS (
      SELECT ST_Transform(ST_SetSRID(ST_MakePoint(2.01,46.01),4326),2154) AS p
    ), invalid_label AS (
      SELECT ST_Transform(ST_SetSRID(ST_MakePoint(2.02,46.02),4326),2154) AS p
    ) INSERT INTO postal.postal_area ("inseeCom","postalCode",geometry)
      SELECT '96001','96001', ST_MakeEnvelope(
        ST_X(p)-100,ST_Y(p)-100,ST_X(p),ST_Y(p)+100,2154) FROM center
      UNION ALL SELECT '96001','96002', ST_MakeEnvelope(
        ST_X(p),ST_Y(p)-100,ST_X(p)+100,ST_Y(p)+100,2154) FROM center
      UNION ALL SELECT '96002','96003', ST_MakeEnvelope(
        ST_X(p)-100,ST_Y(p)-100,ST_X(p)+100,ST_Y(p)+100,2154) FROM mono
      UNION ALL SELECT '96003','96004', ST_MakeEnvelope(
        ST_X(p)-50,ST_Y(p)-50,ST_X(p)+50,ST_Y(p)+50,2154) FROM center
      UNION ALL SELECT '96003','96005', ST_MakeEnvelope(
        ST_X(p)-50,ST_Y(p)-50,ST_X(p)+50,ST_Y(p)+50,2154) FROM center
      UNION ALL SELECT '96004','96006', ST_MakeEnvelope(
        ST_X(p)-100,ST_Y(p)-100,ST_X(p)+100,ST_Y(p)+100,2154) FROM invalid_label`)
    console.info(`[postal-test] created ${name}; loopback:${testPort}; temporary storage`)
  }, 30000)

  afterAll(async () => {
    try { await pool?.end() } finally {
      if (containerId) {
        inspectOwnedIdentity()
        run('rm', '--force', containerId)
        console.info(`[postal-test] removed owned container ${name}`)
      }
    }
  })

  const lookup = () => createPostalLookup(createPostalRepository(pool!))

  it('creates only its reference schema, indexes and empty-migration storage', async () => {
    const indexes = await pool!.query(`SELECT indexname FROM pg_indexes WHERE schemaname='postal'`)
    expect(indexes.rows.map(row => row.indexname)).toEqual(expect.arrayContaining([
      'postal_area_geometry_idx', 'postal_area_commune_idx',
    ]))
    const ban = await pool!.query(
      `SELECT 1 FROM information_schema.schemata WHERE schema_name='ban'`,
    )
    expect(ban.rowCount).toBe(0)
  })

  it('sorts commune codes and preserves their delivery labels', async () => {
    await expect(lookup()({ inseeCom: '96001' })).resolves.toMatchObject({
      code_postal: ['96001', '96002'],
      libelles_acheminement: { '96001': 'SECTEUR FICTIF A', '96002': 'SECTEUR FICTIF B' },
    })
    await expect(lookup()({ inseeCom: '96099' })).rejects.toMatchObject({ status: 404 })
  })

  it('transforms WGS84 and optionally restricts the commune', async () => {
    const position = { long: 2.01, lat: 46.01 }
    await expect(lookup()({ position })).resolves.toMatchObject({
      code_postal: '96003', libelle_acheminement: 'COMMUNE FICTIVE',
    })
    await expect(lookup()({ inseeCom: '96001', position }))
      .rejects.toMatchObject({ status: 404 })
  })

  it('excludes an exact boundary and never selects an arbitrary overlapping contour', async () => {
    const position = { long: 2, lat: 46 }
    await expect(lookup()({ inseeCom: '96001', position }))
      .rejects.toMatchObject({ status: 404 })
    await expect(lookup()({ inseeCom: '96003', position }))
      .rejects.toMatchObject({ status: 409 })
  })

  it('runs the HTTP entry point with the Prisma pool and isolated database', async () => {
    await verifyDatabase()
    const token = 'f'.repeat(36)
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
      cwd: path.resolve(import.meta.dirname, '..'),
      env: {
        PATH: process.env.PATH,
        PG_URL: `postgresql://postal_test:postal-test-only@127.0.0.1:${testPort}/${database}`,
        POSTAL_CODE_ADMIN_TOKEN: token,
        POSTAL_CODE_PORT: '0',
        POSTAL_CODE_HOST: '127.0.0.1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const exited = new Promise<void>(resolve => { child.once('exit', () => resolve()) })
    try {
      const port = await new Promise<number>((resolve, reject) => {
        let output = ''
        const timeout = setTimeout(() => reject(new Error('HTTP startup timeout')), 10000)
        child.once('error', error => { clearTimeout(timeout); reject(error) })
        child.once('exit', () => {
          clearTimeout(timeout)
          reject(new Error('Postal HTTP entry point exited before readiness'))
        })
        child.stdout.on('data', chunk => {
          output += chunk.toString()
          const match = /HTTP 127\.0\.0\.1:(\d+)/.exec(output)
          if (match) { clearTimeout(timeout); resolve(Number(match[1])) }
        })
      })
      const url = `http://127.0.0.1:${port}/postal-code/long-lat-insee-com?inseeCom=96002`
      const response = await fetch(url, {
        headers: { Authorization: `Token ${token}` }, signal: AbortSignal.timeout(5000),
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        status: 'success', response: {
          code_postal: '96003', libelle_acheminement: 'COMMUNE FICTIVE',
        },
      })
      expect((await fetch(url, { signal: AbortSignal.timeout(5000) })).status).toBe(401)
      for (const query of ['inseeCom=96004', 'long=2.02&lat=46.02']) {
        const invalid = await fetch(
          `http://127.0.0.1:${port}/postal-code/long-lat-insee-com?${query}`,
          { headers: { Authorization: `Token ${token}` }, signal: AbortSignal.timeout(5000) },
        )
        expect(invalid.status).toBe(503)
        expect(await invalid.json()).toMatchObject({ status: 'error', response: {} })
      }
    } finally {
      if (child.pid && child.exitCode === null && child.signalCode === null) {
        const force = setTimeout(() => { child.kill('SIGKILL') }, 5000)
        child.kill('SIGTERM')
        try { await exited } finally { clearTimeout(force) }
      }
    }
  }, 20000)

  it('distinguishes an unpopulated reference from a missing commune', async () => {
    await verifyDatabase()
    const client = await pool!.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM postal.postal_area')
      await client.query('DELETE FROM postal.datanova')
      await expect(createPostalLookup(createPostalRepository(client))({ inseeCom: '96001' }))
        .rejects.toMatchObject({ status: 503 })
    } finally {
      try { await client.query('ROLLBACK') } finally { client.release() }
    }
    await expect(lookup()({ inseeCom: '96001' })).resolves.toBeDefined()
  })
})
