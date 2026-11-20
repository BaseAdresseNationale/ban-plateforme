/** Cross-module integration: migration, actual transactions and key selection.
 * Opt-in; this harness creates and removes only its own local disposable database.
 */
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'

import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { enrichMessage, prepareMessage } from './keys.js'
import { createRegistry, RegistryUnavailable } from './registry.js'

const enabled = process.env.RUN_TARGET_KEY_POSTGRES_TESTS === '1'
const token = randomBytes(6).toString('hex')
const name = `ban-target-key-test-${token}`
const database = `ban_target_key_${token}`
const image = 'postgis/postgis:17-3.4'
let container: string | undefined
let pool: Pool
let port: number
const docker = (...args: string[]) => execFileSync('docker', args, {
  encoding: 'utf8', timeout: 20_000, stdio: ['ignore', 'pipe', 'pipe'],
}).trim()
const owned = () => {
  if (!container) throw new Error('No owned test container')
  const [state] = JSON.parse(docker('inspect', container))
  expect(state.Id).toBe(container)
  expect(state.Name).toBe(`/${name}`)
  expect(state.Config.Image).toBe(image)
  expect(state.Config.Labels['ban.target-key.test']).toBe(token)
  expect(state.HostConfig.Tmpfs['/var/lib/postgresql/data']).toBeDefined()
  return state
}
const input = (job: string, cog: string, label: string, extra = {}) => prepareMessage({
  id: job, rows: [{ __balRowIndex: 0, commune_insee: cog, voie_nom: label,
    numero: 12, ...extra }],
})
const resolve = (value: ReturnType<typeof input>) => createRegistry(pool)
  .resolve(value, codes => codes[value.rowKeys[0]])
const initialize = (cog: string) => pool.query(
  "INSERT INTO target_key.commune(cog,initialized,source) VALUES($1,true,'synthetic-fixture')",
  [cog],
)

describe.skipIf(!enabled)('isolated PostgreSQL target-key registry', () => {
  beforeAll(async () => {
    expect(JSON.parse(docker('context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}')))
      .toMatch(/^unix:\/\//)
    if (process.env.DOCKER_HOST) expect(process.env.DOCKER_HOST).toMatch(/^unix:\/\//)
    docker('image', 'inspect', image)
    container = docker('run', '--detach', '--pull=never', '--name', name,
      '--label', `ban.target-key.test=${token}`, '--publish', '127.0.0.1::5432',
      '--tmpfs', '/var/lib/postgresql/data', '--env', `POSTGRES_DB=${database}`,
      '--env', 'POSTGRES_USER=target_key_test', '--env', 'POSTGRES_PASSWORD=test-only', image)
    expect(container).toMatch(/^[a-f0-9]{64}$/)
    const ports = owned().NetworkSettings.Ports['5432/tcp']
    expect(ports).toHaveLength(1)
    expect(ports[0].HostIp).toBe('127.0.0.1')
    port = Number(ports[0].HostPort)
    expect(port).toBeGreaterThan(0)
    pool = new Pool({ host: '127.0.0.1', port, database, user: 'target_key_test',
      password: 'test-only', max: 4, connectionTimeoutMillis: 1000 })
    let ready = false
    for (let i = 0; i < 100; i++) {
      try { await pool.query('SELECT 1'); ready = true; break; } catch { await delay(100); }
    }
    expect(ready).toBe(true)
    const { rows: [identity] } = await pool.query(
      'SELECT current_database() AS db,current_user AS role',
    )
    expect(identity).toEqual({ db: database, role: 'target_key_test' })
    expect(owned().NetworkSettings.Ports['5432/tcp'][0].HostPort).toBe(String(port))
    await pool.query(readFileSync(new URL(
      '../../../packages/prisma-client/prisma/migrations/0014_target_key_registry/migration.sql',
      import.meta.url,
    ), 'utf8'))
    console.info(`[target-key-test] ${name}; 127.0.0.1:${port}; database=${database}; tmpfs`)
  }, 30_000)

  afterAll(async () => {
    try { await pool?.end(); } finally {
      if (container) { owned(); docker('rm', '--force', container); }
    }
  })

  it('allows a permanent supplied key without initialized communes or allocations', async () => {
    const value = input('provided-job', '96001', 'Voie fournie fictive', {
      cle_interop: '96099_a001_00012_bis_a',
    })
    expect(value.roads).toHaveLength(0)
    const result = await createRegistry(pool).resolve(value, codes => enrichMessage(value, codes))
    expect(result.rows[0].ban_enrich_retained_cle_interop).toBe('96099_a001_00012_bis_a')
    expect(result.rows[0]).not.toHaveProperty('ban_enrich_deprecated_cle_interop')
    expect((await pool.query('SELECT count(*) FROM target_key.code')).rows[0].count).toBe('0')
  })

  it('requires initialization only for fallback allocations', async () => {
    const value = input('new-way', '96001', 'Nouvelle voie fictive')
    await expect(resolve(value)).rejects.toBeInstanceOf(RegistryUnavailable)
    await initialize('96001')
    const code = await resolve(value)
    expect(code).toMatch(/^[a-z0-9]{6}$/)
    expect(await resolve(value)).toBe(code)
    expect(await resolve(input('new-way-again', '96001', 'NOUVELLE  VOIE FICTIVE'))).toBe(code)
  })

  it('serializes concurrent allocations and retries collisions', async () => {
    await initialize('96002')
    const jobs = Array.from({ length: 8 }, (_, i) =>
      input(`concurrent-${i}`, '96002', 'Voie commune'))
    const codes = await Promise.all(jobs.map(resolve))
    expect(new Set(codes).size).toBe(1)
    const attempts = [codes[0], 'qqq001']
    const other = input('collision-job', '96002', 'Autre voie')
    const code = await createRegistry(pool, () => attempts.shift()!)
      .resolve(other, result => result[other.rowKeys[0]])
    expect(code).toBe('qqq001')
    expect((await pool.query("SELECT count(*) FROM target_key.code WHERE cog='96002'"))
      .rows[0].count).toBe('2')
  })

  it('keeps a UUID binding on rename and refuses ambiguous label-only matching', async () => {
    await initialize('96003')
    const uuid = '00000000-0000-4000-8000-000000000003'
    const first = input('first-name', '96003', 'Premier nom', { id_ban_toponyme: uuid })
    const original = await resolve(first)
    const other = await resolve(input('other-name', '96003', 'Deuxième nom'))
    expect(other).not.toBe(original)
    expect(await resolve(input('rename', '96003', 'Deuxième nom', { id_ban_toponyme: uuid })))
      .toBe(original)
    await expect(resolve(input('ambiguous-name', '96003', 'Deuxième nom')))
      .rejects.toBeInstanceOf(RegistryUnavailable)
    expect(await resolve(input('bound-name', '96003', 'Deuxième nom', { id_ban_toponyme: uuid })))
      .toBe(original)
    expect(await resolve(first)).toBe(original)
  })

  it('preserves old scope bindings while allowing the same UUID in a new commune', async () => {
    await initialize('96004'); await initialize('96005')
    const uuid = '00000000-0000-4000-8000-000000000004'
    const oldScope = input('old-scope', '96004', 'Voie transférable', { id_ban_toponyme: uuid })
    const oldCode = await resolve(oldScope)
    await resolve(input('new-scope', '96005', 'Voie transférable', { id_ban_toponyme: uuid }))
    expect(await resolve(oldScope)).toBe(oldCode)
    expect((await pool.query('SELECT count(*) FROM target_key.binding WHERE toponym_id=$1', [uuid]))
      .rows[0].count).toBe('2')
  })

  it('rolls back rejected messages and refuses conflicting replay', async () => {
    const bad = input('rollback-job', '96001', 'Nom à annuler')
    await expect(createRegistry(pool).resolve(bad, () => {
      throw new Error('synthetic rejection')
    })).rejects.toThrow('synthetic rejection')
    expect((await pool.query('SELECT count(*) FROM target_key.request WHERE id=$1', [bad.id]))
      .rows[0].count).toBe('0')
    const good = input('stable-request', '96001', 'Voie conservée')
    await resolve(good)
    await expect(resolve(input('stable-request', '96001', 'Autre contenu')))
      .rejects.toBeInstanceOf(RegistryUnavailable)
  })
})
