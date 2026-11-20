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
import { writePostalReferences } from './reference-writer.js'
import type { ReferencePool, ReferenceSink } from './reference-writer.js'

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
      password: 'postal-test-only', connectionTimeoutMillis: 1000, query_timeout: 3000, max: 3 })
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

  const candidate = (cog = '96010', code = '96010') => async (sink: ReferenceSink) => {
    await sink.code({ cog, code, label: 'REFERENCE FICTIVE' })
    await sink.area({ cog, code, sourceSrid: 4326,
      geometry: { type: 'Polygon', coordinates: [[[1,45],[3,45],[3,47],[1,45]]] } })
  }

  const live = async () => (await pool!.query(`
    SELECT (SELECT jsonb_agg(jsonb_build_array("inseeCom", "postalCodes",
      "libelleAcheminementWithPostalCodes") ORDER BY "inseeCom") FROM postal.datanova) AS codes,
      (SELECT jsonb_agg(jsonb_build_array("inseeCom", "postalCode", ST_AsEWKB(geometry))
        ORDER BY "inseeCom", "postalCode", id) FROM postal.postal_area) AS areas
  `)).rows[0]

  it('validates a dry run with PostGIS without changing the live snapshot', async () => {
    await verifyDatabase()
    const before = await live()
    expect(await writePostalReferences(pool!, async sink => {
      await candidate()(sink)
      await sink.code({ cog: '96010', code: '96010', label: 'REFERENCE FICTIVE' })
    })).toEqual({ applied: false, communes: 1, codes: 1, areas: 1 })
    expect(await live()).toEqual(before)
  })

  it.each(['missing-code', 'conflicting-label', 'invalid-geometry'])(
    'rejects %s without publishing any partial reference', async scenario => {
      await verifyDatabase()
      const before = await live()
      await expect(writePostalReferences(pool!, async sink => {
        await candidate()(sink)
        if (scenario === 'missing-code') {
          await sink.area({ cog: '96099', code: '96099', sourceSrid: 2154,
            geometry: { type: 'Polygon', coordinates: [[[0,0],[2,0],[2,2],[0,0]]] } })
        } else if (scenario === 'conflicting-label') {
          await sink.code({ cog: '96010', code: '96010', label: 'CONTRADICTION FICTIVE' })
        } else {
          await sink.area({ cog: '96010', code: '96010', sourceSrid: 2154,
            geometry: { type: 'Polygon', coordinates: [[[0,0],[2,2],[2,0],[0,2],[0,0]]] } })
        }
      }, { apply: true })).rejects.toThrow()
      expect(await live()).toEqual(before)
    },
  )

  it('rolls back live deletes when publication fails after staging', async () => {
    await verifyDatabase()
    const before = await live()
    await pool!.query(`CREATE FUNCTION postal.reject_test_publication() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$;
      CREATE TRIGGER reject_test_publication BEFORE INSERT ON postal.datanova
      FOR EACH ROW EXECUTE FUNCTION postal.reject_test_publication()`)
    try {
      await expect(writePostalReferences(pool!, candidate(), { apply: true }))
        .rejects.toMatchObject({ kind: 'storage' })
      expect(await live()).toEqual(before)
    } finally {
      await pool!.query(`DROP TRIGGER reject_test_publication ON postal.datanova;
        DROP FUNCTION postal.reject_test_publication()`)
    }
  })

  it('publishes both complete references and does not accumulate rows on replay', async () => {
    await verifyDatabase()
    expect(await writePostalReferences(pool!, candidate(), { apply: true }))
      .toEqual({ applied: true, communes: 1, codes: 1, areas: 1 })
    const first = await live()
    await expect(lookup()({ inseeCom: '96010', position: { long: 2, lat: 45.5 } }))
      .resolves.toMatchObject({ code_postal: '96010', libelle_acheminement: 'REFERENCE FICTIVE' })
    await expect(lookup()({ inseeCom: '96002' })).rejects.toMatchObject({ status: 404 })
    await writePostalReferences(pool!, candidate(), { apply: true })
    expect(await live()).toEqual(first)
  })

  it('keeps readers on the previous version and serializes concurrent publications', async () => {
    await verifyDatabase()
    const before = await live()
    let releasePublication!: () => void
    let stagedPublication!: () => void
    const held = new Promise<void>(resolve => { releasePublication = resolve })
    const ready = new Promise<void>(resolve => { stagedPublication = resolve })
    const delayed: ReferencePool = {
      async connect() {
        const client = await pool!.connect()
        return {
          async query(sql, values) {
            const result = await client.query(sql, values)
            if (sql.includes('DELETE FROM postal.')) {
              stagedPublication()
              await held
            }
            return result
          },
          release: error => client.release(error),
        }
      },
    }
    const first = writePostalReferences(delayed, candidate('96020','96020'), { apply: true })
    let secondStaged!: () => void
    const secondReady = new Promise<void>(resolve => { secondStaged = resolve })
    let second: Promise<unknown> | undefined
    try {
      await Promise.race([ready, first])
      second = writePostalReferences(pool!, async sink => {
        await candidate('96030','96030')(sink)
        secondStaged()
      }, { apply: true })
      await Promise.race([secondReady, second])
      expect(await live()).toEqual(before)
    } finally {
      releasePublication()
      await Promise.allSettled([first, second])
    }
    await Promise.all([first, second])
    await expect(lookup()({ inseeCom: '96030' })).resolves.toMatchObject({ code_postal: '96030' })
    await expect(lookup()({ inseeCom: '96020' })).rejects.toMatchObject({ status: 404 })
    const totals = await pool!.query(`SELECT
      (SELECT count(*)::int FROM postal.datanova) AS codes,
      (SELECT count(*)::int FROM postal.postal_area) AS areas`)
    expect(totals.rows[0]).toEqual({ codes: 1, areas: 1 })
  })
})
