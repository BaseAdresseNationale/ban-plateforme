/** Intégration transversale : migration, import/CLI, requêtes spatiales et HTTP réels.
 * Le test crée sa propre base ; aucune URL utilisateur n'est acceptée.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { setTimeout as delay } from 'node:timers/promises'

import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { replacePostalAreas } from './administration.js'
import { createPostalLookup } from './lookup.js'
import { createPostalRepository } from './repository.js'
import { writePostalReferences } from './reference-writer.js'
import { importPostalReferences } from './reference-import.js'
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

  async function withHttpServer(test: (base: string, token: string) => Promise<void>,
    user = 'postal_test', password = 'postal-test-only', adminEnabled = false) {
    await verifyDatabase()
    const token = 'f'.repeat(36)
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
      cwd: path.resolve(import.meta.dirname, '..'),
      env: {
        PATH: process.env.PATH,
        PG_URL: `postgresql://${user}:${password}@127.0.0.1:${testPort}/${database}`,
        POSTAL_CODE_ADMIN_TOKEN: token,
        POSTAL_CODE_ADMIN_ENABLED: String(adminEnabled),
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
      await test(`http://127.0.0.1:${port}`, token)
    } finally {
      if (child.pid && child.exitCode === null && child.signalCode === null) {
        const force = setTimeout(() => { child.kill('SIGKILL') }, 5000)
        child.kill('SIGTERM')
        try { await exited } finally { clearTimeout(force) }
      }
    }
  }

  it('runs the HTTP entry point with the Prisma pool and isolated database', async () => {
    await withHttpServer(async (base, token) => {
      const url = `${base}/postal-code/long-lat-insee-com?inseeCom=96002`
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
          `${base}/postal-code/long-lat-insee-com?${query}`,
          { headers: { Authorization: `Token ${token}` }, signal: AbortSignal.timeout(5000) },
        )
        expect(invalid.status).toBe(503)
        expect(await invalid.json()).toMatchObject({ status: 'error', response: {} })
      }
    })
  }, 20000)

  it('does not mount administration unless enabled in the real entry point', async () => {
    await withHttpServer(async (base, token) => {
      const response = await fetch(`${base}/postal-code/postal-datanova`, {
        method: 'PUT', headers: { Authorization: `Token ${token}`,
          'Content-Type': 'application/json' }, body: '[]', signal: AbortSignal.timeout(5000),
      })
      expect(response.status).toBe(404)
    })
  }, 20000)

  it('updates existing communes over real HTTP, reports missing ones and validates first', async () => {
    await verifyDatabase()
    try {
      await withHttpServer(async (base, token) => {
        const url = `${base}/postal-code/postal-datanova`
        const headers = { Authorization: `Token ${token}`, 'Content-Type': 'application/json' }
        const item = { inseeCom: '96002', postalCodes: ['96003'],
          libelleAcheminementWithPostalCodes: { '96003': 'LIBELLE FICTIF MODIFIE' } }
        const response = await fetch(url, { method: 'PUT', headers,
          body: JSON.stringify([item, { ...item, inseeCom: '96099' }]),
          signal: AbortSignal.timeout(5000) })
        expect(response.status).toBe(207)
        expect(await response.json()).toMatchObject({ response: {
          totalUpdated: 1, failedUpdates: [{ inseeCom: '96099', updatedRowsCount: 0 }],
        } })
        await expect(lookup()({ inseeCom: '96002' })).resolves.toMatchObject({
          libelle_acheminement: 'LIBELLE FICTIF MODIFIE',
        })
        const before = await live()
        expect((await fetch(url, { method: 'PUT', headers,
          body: JSON.stringify([item, { ...item, id: 1 }]),
          signal: AbortSignal.timeout(5000) })).status).toBe(400)
        expect((await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: '{broken', signal: AbortSignal.timeout(5000) })).status).toBe(401)
        expect(await live()).toEqual(before)
        expect((await fetch(url, { method: 'PUT', headers, body: JSON.stringify([item]),
          signal: AbortSignal.timeout(5000) })).status).toBe(200)
      }, 'postal_test', 'postal-test-only', true)
    } finally {
      await verifyDatabase()
      await pool!.query(`UPDATE postal.datanova SET "libelleAcheminementWithPostalCodes" =
        '{"96003":"COMMUNE FICTIVE"}' WHERE "inseeCom" = '96002'`)
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

  it('replaces only one commune over HTTP and rolls back invalid or failed contours', async () => {
    await verifyDatabase()
    try {
      await withHttpServer(async (base, token) => {
        const url = `${base}/postal-code/postal-area/district/cog/96020`
        const headers = { Authorization: `Token ${token}`, 'Content-Type': 'application/json' }
        const item = { postalCode: '96020', geometry: {
          type: 'Polygon', coordinates: [[[0, 0], [20, 0], [20, 20], [0, 0]]],
        } }
        const send = (items: unknown) => fetch(url, { method: 'PUT', headers,
          body: JSON.stringify(items), signal: AbortSignal.timeout(5000) })
        const original = await live()
        const response = await send([item])
        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({ response: { createdCount: 1, deletedCount: 0 } })
        const first = await live()
        expect(first.codes).toEqual(original.codes)
        expect(first.areas).toHaveLength(original.areas.length + 1)
        const replay = await send([item])
        expect(await replay.json()).toMatchObject({ response: { createdCount: 1, deletedCount: 1 } })
        expect(await live()).toEqual(first)
        for (const invalid of [[], [{ ...item, id: 1 }], [{ ...item, geometry: {
          type: 'Point', coordinates: [0, 0],
        } }], [item, { ...item, geometry: {
          type: 'Polygon', coordinates: [[[0, 0], [20, 20], [20, 0], [0, 20], [0, 0]]],
        } }]]) {
          expect((await send(invalid)).status).toBe(400)
          expect(await live()).toEqual(first)
        }
        await verifyDatabase()
        await pool!.query(`CREATE FUNCTION postal.reject_admin_test() RETURNS trigger
          LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private synthetic failure'; END $$;
          CREATE TRIGGER reject_admin_test BEFORE INSERT ON postal.postal_area
          FOR EACH ROW EXECUTE FUNCTION postal.reject_admin_test()`)
        try {
          const failed = await send([item])
          expect(failed.status).toBe(503)
          expect(JSON.stringify(await failed.json())).not.toContain('private')
          expect(await live()).toEqual(first)
        } finally {
          await verifyDatabase()
          await pool!.query(`DROP TRIGGER reject_admin_test ON postal.postal_area;
            DROP FUNCTION postal.reject_admin_test()`)
        }
      }, 'postal_test', 'postal-test-only', true)
    } finally {
      await verifyDatabase()
      await pool!.query('DELETE FROM postal.postal_area WHERE "inseeCom" = $1', ['96020'])
    }
  }, 20000)

  it('uses a restricted admin role and cannot bypass a read-only PostgreSQL role', async () => {
    await verifyDatabase()
    await pool!.query(`CREATE ROLE postal_admin_test LOGIN PASSWORD 'postal-admin-test-only';
      CREATE ROLE postal_admin_readonly LOGIN PASSWORD 'postal-readonly-test-only';
      GRANT USAGE ON SCHEMA postal TO postal_admin_test, postal_admin_readonly;
      GRANT SELECT ON ALL TABLES IN SCHEMA postal TO postal_admin_test, postal_admin_readonly;
      GRANT UPDATE ON postal.datanova TO postal_admin_test;
      GRANT INSERT, DELETE ON postal.postal_area TO postal_admin_test;
      GRANT USAGE ON SEQUENCE postal.postal_area_id_seq TO postal_admin_test`)
    const item = { inseeCom: '96002', postalCodes: ['96003'],
      libelleAcheminementWithPostalCodes: { '96003': 'COMMUNE FICTIVE' } }
    const area = { postalCode: '96021', geometry: {
      type: 'Polygon', coordinates: [[[0, 0], [20, 0], [20, 20], [0, 0]]],
    } }
    try {
      for (const role of [
        { user: 'postal_admin_test', password: 'postal-admin-test-only', codeStatus: 200,
          areaStatus: 200 },
        { user: 'postal_admin_readonly', password: 'postal-readonly-test-only', codeStatus: 207,
          areaStatus: 503 },
      ]) {
        await withHttpServer(async (base, token) => {
          const before = await live()
          const send = (route: string, body: unknown) => fetch(`${base}/postal-code/${route}`, {
            method: 'PUT', headers: { Authorization: `Token ${token}`,
              'Content-Type': 'application/json' },
            body: JSON.stringify(body), signal: AbortSignal.timeout(5000),
          })
          expect((await send('postal-datanova', [item])).status).toBe(role.codeStatus)
          const result = await send('postal-area/district/cog/96021', [area])
          expect(result.status).toBe(role.areaStatus)
          if (role.areaStatus === 503) {
            expect(await live()).toEqual(before)
            expect(JSON.stringify(await result.json())).not.toContain('permission denied')
          }
        }, role.user, role.password, true)
      }
    } finally {
      await verifyDatabase()
      await pool!.query('DELETE FROM postal.postal_area WHERE "inseeCom" = $1', ['96021'])
    }
  }, 20000)

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

  it('serializes administration behind a complete import without exposing partial data', async () => {
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
    let adminPid: number | undefined
    const observed: ReferencePool = {
      async connect() {
        const client = await pool!.connect()
        try {
          const { rows: [row] } = await client.query('SELECT pg_backend_pid() AS pid')
          adminPid = row.pid
        } catch (error) { client.release(); throw error }
        return { query: (sql, values) => client.query(sql, values),
          release: error => client.release(error) }
      },
    }
    const geometry = { type: 'Polygon', coordinates: [[[0, 0], [20, 0], [20, 20], [0, 0]]] }
    const publication = writePostalReferences(delayed, candidate('96070', '96070'), { apply: true })
    let administration: Promise<unknown> | undefined
    try {
      await Promise.race([ready, publication])
      administration = replacePostalAreas(observed, '96070', [{ postalCode: '96070', geometry }])
      let blocked = false
      const deadline = Date.now() + 3000
      while (Date.now() < deadline) {
        const { rows: [state] } = await pool!.query(
          'SELECT wait_event FROM pg_stat_activity WHERE pid = $1', [adminPid ?? -1],
        )
        if (state?.wait_event === 'advisory') { blocked = true; break }
        await delay(10)
      }
      expect(blocked, 'Admin must wait on the same publication lock as the importer').toBe(true)
      expect(await live()).toEqual(before)
    } finally {
      releasePublication()
      await Promise.allSettled([publication, administration])
    }
    await publication
    expect(await administration).toEqual({ createdCount: 1, deletedCount: 1 })
    const after = await pool!.query(`SELECT "inseeCom", "postalCode",
      public.ST_AsGeoJSON(geometry)::jsonb AS geometry FROM postal.postal_area`)
    expect(after.rows).toEqual([{ inseeCom: '96070', postalCode: '96070', geometry: {
      ...geometry, crs: { type: 'name', properties: { name: 'EPSG:2154' } },
    } }])
    await expect(lookup()({ inseeCom: '96070' })).resolves.toMatchObject({ code_postal: '96070' })
  })

  const importCsv = 'Code_commune_INSEE;Code_postal;Libellé_d_acheminement\n'
    + '96040;96040;IMPORT FICTIF\n96040;96040;IMPORT FICTIF\n'
  const importGeo = JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature',
    properties: { cp: '96040', insee_com: '96040' }, geometry: { type: 'Polygon',
      coordinates: [[[1,45],[3,45],[3,47],[1,45]]] } }],
    crs: { type: 'name', properties: { name: 'EPSG:4326' } } })
  const importSources = (csv = importCsv, geo = importGeo) => ({
    datanova: Readable.from([csv]), areas: Readable.from([geo]), sourceSrid: 4326 as const,
  })

  it('imports streamed CSV/GeoJSON as one candidate and defaults to simulation', async () => {
    await verifyDatabase()
    const before = await live()
    const report = await importPostalReferences(pool!, importSources())
    expect(report).toMatchObject({ applied: false, codes: 1, communes: 1, areas: 1,
      sources: { datanova: { records: 2 }, areas: { records: 1 } } })
    expect(report.sources.datanova.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(await live()).toEqual(before)
  })

  it.each(['truncated', 'projection', 'conflicting-csv'])(
    'preserves the live snapshot on streamed %s failure', async failure => {
      await verifyDatabase()
      const before = await live()
      const csv = failure === 'conflicting-csv'
        ? importCsv + '96040;96040;AUTRE LIBELLE FICTIF\n' : importCsv
      const geo = failure === 'truncated' ? importGeo.slice(0,-1)
        : failure === 'projection' ? importGeo.replace('EPSG:4326','EPSG:2154') : importGeo
      await expect(importPostalReferences(pool!, importSources(csv,geo), { apply: true }))
        .rejects.toMatchObject({ kind: 'invalid-reference' })
      expect(await live()).toEqual(before)
    },
  )

  it('publishes the validated streams with correct spatial results and no replay accumulation', async () => {
    await verifyDatabase()
    await expect(importPostalReferences(pool!, importSources(), { apply: true }))
      .resolves.toMatchObject({ applied: true, codes: 1, areas: 1 })
    await expect(lookup()({ position: { long: 2, lat: 45.5 } }))
      .resolves.toMatchObject({ code_postal: '96040', libelle_acheminement: 'IMPORT FICTIF' })
    const before = await live()
    await importPostalReferences(pool!, importSources(), { apply: true })
    expect(await live()).toEqual(before)
  })

  async function withCliFiles(test: (files: { datanova: string; areas: string }) => Promise<void>) {
    const folder = await mkdtemp(path.join(os.tmpdir(), 'ban-postal-import-cli-' + suffix + '-'))
    const files = { datanova: path.join(folder, 'datanova.csv'), areas: path.join(folder, 'areas.geojson') }
    try {
      await writeFile(files.datanova, importCsv.replaceAll('96040','96050'))
      await writeFile(files.areas, importGeo.replaceAll('96040','96050'))
      await test(files)
    } finally {
      expect(path.dirname(folder)).toBe(os.tmpdir())
      expect(path.basename(folder)).toMatch(new RegExp('^ban-postal-import-cli-' + suffix + '-'))
      await rm(folder, { recursive: true, force: true })
    }
  }

  function command(files: { datanova: string; areas: string }, extra: string[] = [],
    user = 'postal_test', password = 'postal-test-only') {
    inspectOwnedPort()
    return spawnSync(process.execPath, ['--import','tsx','src/import-cli.ts',
      '--datanova',files.datanova,'--areas',files.areas,'--source-srid','4326',
      '--expect-database',database,...extra], {
      cwd: path.resolve(import.meta.dirname,'..'),
      env: { PATH: process.env.PATH,
        PG_URL: `postgresql://${user}:${password}@127.0.0.1:${testPort}/${database}` },
      encoding: 'utf8', timeout: 15000,
    })
  }

  it('runs the real import CLI with identity checks, defaults to dry run and exits cleanly', async () => {
    await verifyDatabase()
    await withCliFiles(async files => {
      const before = await live()
      const run = command(files)
      expect(run.status, run.stderr).toBe(0)
      const report = JSON.parse(run.stdout)
      expect(report).toMatchObject({ status: 'success', applied: false, codes: 1, areas: 1 })
      expect(run.stdout).not.toContain(files.datanova)
      expect(run.stdout).not.toContain('postgresql://')
      expect(await live()).toEqual(before)
    })
  })

  it('publishes via the real CLI with a restricted postal role, without UPDATE rights', async () => {
    await verifyDatabase()
    await pool!.query(`CREATE ROLE postal_loader_test LOGIN PASSWORD 'postal-loader-test-only';
      GRANT USAGE ON SCHEMA postal TO postal_loader_test;
      GRANT SELECT, INSERT, DELETE ON ALL TABLES IN SCHEMA postal TO postal_loader_test;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA postal TO postal_loader_test;
      CREATE ROLE postal_http_reader_test LOGIN PASSWORD 'postal-reader-test-only';
      GRANT USAGE ON SCHEMA postal TO postal_http_reader_test;
      GRANT SELECT ON ALL TABLES IN SCHEMA postal TO postal_http_reader_test;`)
    const rights = await pool!.query(`SELECT has_table_privilege(
      'postal_loader_test','postal.datanova','UPDATE') AS update`)
    expect(rights.rows[0].update).toBe(false)
    await withCliFiles(async files => {
      const run = command(files,['--apply'],'postal_loader_test','postal-loader-test-only')
      expect(run.status, run.stderr).toBe(0)
      expect(JSON.parse(run.stdout)).toMatchObject({ status: 'success', applied: true,
        sources: { datanova: { records: 2 }, areas: { records: 1 } } })
      await expect(lookup()({ inseeCom: '96050', position: { long: 2, lat: 45.5 } }))
        .resolves.toMatchObject({ code_postal: '96050', libelle_acheminement: 'IMPORT FICTIF' })
    })
  })

  it.each(['truncated', 'wrong-expected-database'])(
    'makes CLI %s failures non-successful and leaves the live version unchanged', async failure => {
      await verifyDatabase()
      await withCliFiles(async files => {
        const before = await live()
        if (failure === 'truncated') await writeFile(files.areas, importGeo.slice(0,-1))
        let run: ReturnType<typeof command>
        if (failure === 'wrong-expected-database') {
          run = spawnSync(process.execPath, ['--import','tsx','src/import-cli.ts',
            '--datanova',files.datanova,'--areas',files.areas,'--source-srid','4326',
            '--expect-database','another_synthetic_database','--apply'], {
            cwd: path.resolve(import.meta.dirname,'..'), encoding:'utf8', timeout:10000,
            env:{ PATH:process.env.PATH,
              PG_URL:`postgresql://postal_test:postal-test-only@127.0.0.1:${testPort}/${database}` },
          })
        } else run = command(files,['--apply'])
        expect(run.status, run.stderr).toBe(2)
        expect(run.stdout).toBe('')
        expect(JSON.parse(run.stderr)).toMatchObject({ status:'error' })
        expect(run.stderr).not.toContain('postgresql://')
        expect(await live()).toEqual(before)
      })
    },
  )

  it('serves the CLI-published version through real HTTP with a read-only database role', async () => {
    await verifyDatabase()
    const rights = await pool!.query(`SELECT has_table_privilege(
      'postal_http_reader_test','postal.datanova','DELETE') AS delete`)
    expect(rights.rows[0].delete).toBe(false)
    await withHttpServer(async (base, token) => {
      const result = await fetch(base + '/postal-code/long-lat-insee-com?inseeCom=96050&long=2&lat=45.5', {
        headers: { Authorization: 'Token ' + token }, signal: AbortSignal.timeout(5000),
      })
      expect(result.status).toBe(200)
      expect(await result.json()).toMatchObject({ status:'success', response:{
        code_postal:'96050', libelle_acheminement:'IMPORT FICTIF',
      } })
    }, 'postal_http_reader_test', 'postal-reader-test-only')
  }, 20000)

  it('executes the documented fictional file examples through the real CLI', async () => {
    await verifyDatabase()
    await withCliFiles(async files => {
      await writeFile(files.datanova, readFileSync(new URL('../fixtures/datanova.fictional.csv', import.meta.url)))
      await writeFile(files.areas, readFileSync(new URL('../fixtures/areas.fictional.geojson', import.meta.url)))
      const run = command(files, ['--apply'], 'postal_loader_test', 'postal-loader-test-only')
      expect(run.status, run.stderr).toBe(0)
      expect(JSON.parse(run.stdout)).toMatchObject({ applied: true, communes: 2, codes: 2, areas: 2 })
      await expect(lookup()({ inseeCom: '96001', position: { long: 2, lat: 46 } }))
        .resolves.toMatchObject({ code_postal: '96001', libelle_acheminement: 'COMMUNE FICTIVE A' })
    })
  })
})
