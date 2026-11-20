/** Contrat transversal : runner de migrations, privilèges, CLI et SQL réels.
 * Opt-in ; le conteneur et la base sont créés et vérifiés par ce test uniquement.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { parseCommand, runCommand } from './command.js'
import { createReference, currentReference } from './reference.js'
import { createDistrictRepository, lockDistrictQuery } from './repository.js'

const enabled = process.env.RUN_DISTRICT_ADMIN_POSTGRES_TESTS === '1'
const image = 'postgis/postgis:17-3.4'
const suffix = randomBytes(6).toString('hex')
const name = `ban-district-admin-test-${suffix}`
const database = `ban_district_admin_${suffix}`
const label = `district-admin-${suffix}`
const root = fileURLToPath(new URL('../../../', import.meta.url))
const id = (number: number) => `11111111-1111-4111-8111-${String(900 + number).padStart(12, '0')}`
const bytes = (value: unknown) => Buffer.from(JSON.stringify(value))
const loaded = createReference(currentReference, {
  communes: bytes([{ code: '96001', nom: 'COMMUNE FICTIVE', type: 'commune-actuelle',
    population: 0, codesPostaux: [] }]),
  departements: bytes([{ code: '96', nom: 'DEPARTEMENT FICTIF' }]),
  regions: bytes([{ code: '99', nom: 'REGION FICTIVE' }]),
})
const resolved = loaded.resolve('96001')
if (resolved.status !== 'found') throw new Error('Expected synthetic context')
const payload = { sourceCog: '96001', reference: loaded.reference,
  context: resolved.context, contentHash: resolved.contentHash }
let containerId: string | undefined
let port: number | undefined
let owner: Pool | undefined
let service: Pool | undefined
let missingExecuteRejected = false
const run = (...args: string[]) => execFileSync('docker', args, {
  encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'],
}).trim()

function inspectOwnedIdentity() {
  if (!containerId) throw new Error('No owned district container')
  const [state] = JSON.parse(run('inspect', containerId))
  expect(state.Id).toBe(containerId)
  expect(state.Name).toBe(`/${name}`)
  expect(state.Config.Labels['ban.district-admin.test']).toBe(label)
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
  const value = Number(ports[0].HostPort)
  if (port !== undefined) expect(value).toBe(port)
  expect(value).toBeGreaterThan(0)
  return value
}

async function verifyOwner() {
  inspectOwnedPort()
  const { rows: [identity] } = await owner!.query(
    'SELECT current_database() AS db, current_user AS role',
  )
  expect(identity).toEqual({ db: database, role: 'district_owner' })
}

function connection(user: string) {
  return { host: '127.0.0.1', port, database, user, password: 'district-test-only',
    connectionTimeoutMillis: 2000, statement_timeout: 15000, max: 3 }
}

function serviceEnvironment() {
  return { ...process.env, NODE_OPTIONS: '', PGSSLMODE: 'disable',
    PG_URL: `postgresql://district_sync:district-test-only@127.0.0.1:${port}/${database}` }
}

const repository = () => createDistrictRepository(service!)
const command = (number: number, apply = false) => parseCommand([
  'refresh', '--district', id(number), ...(apply ? ['--apply'] : []),
])
const lookupState = async () => {
  const { rows } = await owner!.query('SELECT to_jsonb(d) AS value FROM ban.district d ORDER BY id')
  return rows
}
const exportsState = async () => {
  const { rows } = await owner!.query(`
    SELECT 'full' AS mode, value FROM ban.snapshot_district_ndjson('2026-01-15') AS value
    UNION ALL
    SELECT 'diff', value FROM ban.diff_district_ndjson('2026-01-01','2026-02-01') AS value
    ORDER BY mode, value`)
  return rows
}

describe.skipIf(!enabled)('owned disposable district administration', () => {
  beforeAll(async () => {
    const endpoint = run('context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}')
    expect(JSON.parse(endpoint)).toMatch(/^unix:\/\//)
    if (process.env.DOCKER_HOST) expect(process.env.DOCKER_HOST).toMatch(/^unix:\/\//)
    run('image', 'inspect', image)
    containerId = run('run', '--detach', '--pull=never', '--name', name,
      '--label', `ban.district-admin.test=${label}`, '--publish', '127.0.0.1::5432',
      '--tmpfs', '/var/lib/postgresql/data', '--env', `POSTGRES_DB=${database}`,
      '--env', 'POSTGRES_USER=district_owner',
      '--env', 'POSTGRES_PASSWORD=district-test-only', image)
    expect(containerId).toMatch(/^[a-f0-9]{64}$/)
    port = inspectOwnedPort()
    owner = new Pool(connection('district_owner'))
    let ready = false
    for (let attempt = 0; attempt < 100; attempt++) {
      try { await owner.query('SELECT 1'); ready = true; break } catch { await delay(100) }
    }
    expect(ready, 'Dedicated district PostgreSQL did not become ready').toBe(true)
    await verifyOwner()
    for (const file of ['.env', 'packages/prisma-client/.env']) {
      expect(existsSync(`${root}/${file}`), 'Personal environment must be absent').toBe(false)
    }
    // Le runner réel découvre 0013 sans dépendre de la migration postale 0012.
    const migration = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy',
      '--config', 'packages/prisma-client/prisma.config.ts'], {
      cwd: root,
      env: { ...process.env, NODE_OPTIONS: '', PGSSLMODE: 'disable',
        PG_URL: `postgresql://district_owner:district-test-only@127.0.0.1:${port}/`
          + `${database}?schema=ban`,
        PRISMA_ENGINES_MIRROR: 'http://127.0.0.1:1' },
      encoding: 'utf8', timeout: 30000,
    })
    expect(migration.status, migration.stdout + migration.stderr).toBe(0)
    await verifyOwner()
    for (let number = 1; number <= 9; number++) {
      await owner.query(`INSERT INTO ban.district
        (id,labels,"updateDate",config,meta,range_validity,"isActive") VALUES
        ($1::uuid, ARRAY['{"isoCode":"fra","value":"OBJET FICTIF"}'::jsonb],
         '2026-01-01','{"kept":true}','{"insee":{"cog":"96001"},"bal":{"kept":true}}',
         tstzrange('2026-01-01',NULL),true)`, [id(number)])
    }
    await owner.query("CREATE ROLE district_sync LOGIN PASSWORD 'district-test-only'")
    await owner.query('GRANT USAGE ON SCHEMA ban, district_admin TO district_sync')
    await owner.query('GRANT SELECT (id,meta,"isActive") ON ban.district TO district_sync')
    await owner.query('GRANT SELECT,INSERT,UPDATE ON district_admin.context TO district_sync')
    service = new Pool(connection('district_sync'))
    const { rows: [identity] } = await service.query(
      'SELECT current_database() AS db, current_user AS role',
    )
    expect(identity).toEqual({ db: database, role: 'district_sync' })
    try { await service.query(lockDistrictQuery, [id(1)]) } catch (error) {
      missingExecuteRejected = (error as { code?: string }).code === '42501'
    }
    expect(missingExecuteRejected).toBe(true)
    await owner.query(
      'GRANT EXECUTE ON FUNCTION district_admin.lock_district(uuid) TO district_sync',
    )
    console.info(`[district-test] created ${name}; loopback:${port}; temporary storage`)
  }, 60000)

  afterAll(async () => {
    try { await service?.end() } finally {
      try { await owner?.end() } finally {
        if (containerId) {
          inspectOwnedIdentity()
          run('rm', '--force', containerId)
          console.info(`[district-test] removed owned container ${name}`)
        }
      }
    }
  })

  it('limits the privileged helper to reading and locking, never grants UPDATE BAN', async () => {
    expect(missingExecuteRejected).toBe(true)
    const { rows: [rights] } = await service!.query(`SELECT
      has_any_column_privilege(current_user,'ban.district','UPDATE') AS can_update,
      has_table_privilege(current_user,'ban.district','DELETE') AS can_delete`)
    expect(rights).toEqual({ can_update: false, can_delete: false })
    await expect(service!.query('UPDATE ban.district SET id=id WHERE id=$1', [id(1)]))
      .rejects.toMatchObject({ code: '42501' })
    await expect(service!.query("UPDATE ban.district SET meta='{}' WHERE id=$1", [id(1)]))
      .rejects.toMatchObject({ code: '42501' })
    await expect(service!.query('SELECT id FROM ban.district WHERE id=$1 FOR UPDATE', [id(1)]))
      .rejects.toMatchObject({ code: '42501' })
    const { rows: [definition] } = await owner!.query(`SELECT p.prosecdef, p.proconfig,
      pg_get_functiondef(p.oid) AS body FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='district_admin' AND p.proname='lock_district'`)
    expect(definition.prosecdef).toBe(true)
    expect(definition.proconfig).toEqual(['search_path=pg_catalog'])
    expect(definition.body).toContain('FROM ban.district')
    expect(definition.body).not.toMatch(/\b(?:INSERT|DELETE|TRUNCATE)\b/)
  })

  it('applies/reads a context and keeps BAN objects and exports byte-identical', async () => {
    const before = await lookupState()
    const exportsBefore = await exportsState()
    expect(await runCommand(command(1), { repository: repository(), load: async () => loaded }))
      .toMatchObject({ mode: 'dry-run', status: 'updated' })
    expect((await owner!.query('SELECT 1 FROM district_admin.context')).rowCount).toBe(0)
    expect(await runCommand(command(1, true), {
      repository: repository(), load: async () => loaded,
    })).toMatchObject({
      mode: 'apply', status: 'updated', context: { population: 0, postalCodes: [] },
    })
    expect(await lookupState()).toEqual(before)
    expect(await exportsState()).toEqual(exportsBefore)
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts',
      'read', '--district', id(1)], {
      cwd: fileURLToPath(new URL('../', import.meta.url)), env: serviceEnvironment(),
      encoding: 'utf8', timeout: 15000,
    })
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ mode: 'read', status: 'unchanged',
      sourceCog: '96001', context: { name: 'COMMUNE FICTIVE' } })
  })

  it('makes concurrent replays idempotent without changing recorded_at or BAN data', async () => {
    const before = await lookupState()
    const statuses = await Promise.all([
      repository().save(id(2), '96001', payload, true),
      repository().save(id(2), '96001', payload, true),
    ])
    expect(statuses.sort()).toEqual(['unchanged', 'updated'])
    const beforeReplay = await owner!.query(
      'SELECT * FROM district_admin.context WHERE district_id=$1', [id(2)],
    )
    expect(await repository().save(id(2), '96001', payload, true)).toBe('unchanged')
    expect((await owner!.query('SELECT * FROM district_admin.context WHERE district_id=$1',
      [id(2)])).rows).toEqual(beforeReplay.rows)
    expect(await lookupState()).toEqual(before)
  })

  it('rechecks concurrent COG changes and detects stale stored contexts', async () => {
    await repository().save(id(3), '96001', payload, true)
    const transaction = await owner!.connect()
    try {
      await transaction.query('BEGIN')
      await transaction.query('SELECT id FROM ban.district WHERE id=$1 FOR UPDATE', [id(3)])
      const pending = repository().save(id(3), '96001', payload, true)
      await transaction.query(`UPDATE ban.district
        SET meta=jsonb_set(meta,'{insee,cog}','"96002"') WHERE id=$1`, [id(3)])
      await transaction.query('COMMIT')
      expect(await pending).toBe('stale')
    } finally {
      await transaction.query('ROLLBACK')
      transaction.release()
    }
    const result = await runCommand(parseCommand(['read', '--district', id(3)]), {
      repository: repository(), load: async () => { throw new Error('Unexpected fetch') },
    })
    expect(result).toMatchObject({ status: 'stale', reason: 'district-cog-changed' })
    expect(result).not.toHaveProperty('context')
    expect((await owner!.query('SELECT source_cog FROM district_admin.context WHERE district_id=$1',
      [id(3)])).rows[0].source_cog).toBe('96001')
  })

  it('does not write if COG or activity changes while loading the reference', async () => {
    for (const number of [6, 7]) {
      const result = await runCommand(command(number, true), {
        repository: repository(),
        load: async () => {
          await owner!.query(number === 6
            ? `UPDATE ban.district SET meta=jsonb_set(meta,'{insee,cog}','"96002"') WHERE id=$1`
            : 'UPDATE ban.district SET "isActive"=false WHERE id=$1', [id(number)])
          return loaded
        },
      })
      expect(result.status).toBe('stale')
      expect((await owner!.query('SELECT 1 FROM district_admin.context WHERE district_id=$1',
        [id(number)])).rowCount).toBe(0)
    }
  })

  it('rolls back permission failures without reporting a successful write', async () => {
    await verifyOwner()
    await owner!.query('REVOKE INSERT ON district_admin.context FROM district_sync')
    try {
      const before = await lookupState()
      const result = await runCommand(command(4, true), {
        repository: repository(), load: async () => loaded,
      })
      expect(result).toMatchObject({ status: 'failed', reason: 'storage-unavailable-or-invalid' })
      expect((await owner!.query('SELECT 1 FROM district_admin.context WHERE district_id=$1',
        [id(4)])).rowCount).toBe(0)
      expect(await lookupState()).toEqual(before)
      expect((await service!.query('SELECT 1 AS available')).rows[0].available).toBe(1)
    } finally {
      await owner!.query('GRANT INSERT ON district_admin.context TO district_sync')
    }
  })

  it('rejects a reference pointing to another COG and keeps FK protection', async () => {
    await expect(repository().save(id(5), '96002', payload, true)).rejects.toThrow()
    expect(await repository().save(id(99), '96001', payload, true)).toBe('missing')
    await expect(owner!.query(`INSERT INTO district_admin.context
      (district_id,source_cog,reference,context,content_hash) VALUES
      ($1,'96001',$2::jsonb,$3::jsonb,$4)`,
    [id(99), JSON.stringify(payload.reference),
      JSON.stringify(payload.context), payload.contentHash]))
      .rejects.toMatchObject({ code: '23503' })
  })
})
