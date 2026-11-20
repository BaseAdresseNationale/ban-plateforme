/** Cross-module contract: real BAL consumer, registry transactions and Rascal confirmations.
 * Opt-in only; both containers, their data and broker namespace belong to this harness.
 */
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'

import { Pool } from 'pg'
import rascal from 'rascal'
import type { BrokerConfig, Recovery } from 'rascal'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { rabbitExchanges, routingKeys } from '@ban/rabbitmq/pipeline'

import { createConsumer } from './consumer.js'
import type { Registry } from './consumer.js'
import { shutdownFailedBroker } from './index.js'
import { publishConfirmed } from './publish-confirmed.js'
import type { PublishBroker } from './publish-confirmed.js'
import { createRabbitConfig, publications, subscriptions } from './rabbitmq.config.js'
import { createRegistry } from './registry.js'

const enabled = process.env.RUN_TARGET_KEY_SERVICE_TESTS === '1'
const token = randomBytes(6).toString('hex')
const prefix = `target-key-service-${token}`
const namespace = `target_key_${token}`
const user = 'target_key_test'
const password = 'synthetic-only'
const images = { postgres: 'postgis/postgis:17-3.4', rabbit: 'rabbitmq:3.13-management' }
const containers: { id: string; name: string; image: string; mount: string }[] = []
let pool: Pool | undefined
let broker: Awaited<ReturnType<typeof rascal.BrokerAsPromised.create>> | undefined
let transient: string | undefined
const events = new EventEmitter()
const records: { kind: string; id: string; content?: unknown; attempts?: unknown }[] = []

const docker = (...args: string[]) => execFileSync('docker', args, {
  encoding: 'utf8', timeout: 20_000, stdio: ['ignore', 'pipe', 'pipe'],
}).trim()

const inspect = (resource: typeof containers[number]) => {
  const [state] = JSON.parse(docker('inspect', resource.id))
  expect(state.Id).toBe(resource.id)
  expect(state.Name).toBe(`/${resource.name}`)
  expect(state.Config.Image).toBe(resource.image)
  expect(state.Config.Labels['ban.target-key.service-test']).toBe(token)
  expect(state.HostConfig.Tmpfs[resource.mount]).toBeDefined()
  return state
}

const launch = (kind: keyof typeof images, mount: string, port: string, env: string[]) => {
  const name = `${prefix}-${kind}`
  const id = docker('run', '--detach', '--pull=never', '--name', name,
    '--label', `ban.target-key.service-test=${token}`, '--tmpfs', mount,
    '--publish', `127.0.0.1::${port}`, ...env.flatMap(value => ['--env', value]), images[kind])
  expect(id).toMatch(/^[a-f0-9]{64}$/)
  const resource = { id, name, image: images[kind], mount }
  containers.push(resource)
  const ports = inspect(resource).NetworkSettings.Ports[`${port}/tcp`]
  expect(ports).toHaveLength(1)
  expect(ports[0].HostIp).toBe('127.0.0.1')
  return { resource, port: Number(ports[0].HostPort) }
}

const record = (value: typeof records[number]) => {
  records.push(value)
  events.emit('record')
}
const observed = (kind: string, id: string, count = 1) => new Promise<void>((resolve, reject) => {
  const check = () => {
    if (records.filter(value => value.kind === kind && value.id === id).length < count) return
    clearTimeout(timer)
    events.removeListener('record', check)
    resolve()
  }
  const timer = setTimeout(() => {
    events.removeListener('record', check)
    reject(new Error('Expected isolated service event was not observed'))
  }, 5_000)
  events.on('record', check)
  check()
})
const message = (id: string, name = 'Voie de test') => ({ id, rows: [{
  __balRowIndex: 0, commune_insee: '96001', voie_nom: name, numero: 12,
}] })
const send = (content: unknown) => publishConfirmed(broker!, 'fixtureInput', content)

describe.skipIf(!enabled)('isolated target-key PostgreSQL/RabbitMQ service', () => {
  beforeAll(async () => {
    expect(JSON.parse(docker('context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}')))
      .toMatch(/^unix:\/\//)
    if (process.env.DOCKER_HOST) expect(process.env.DOCKER_HOST).toMatch(/^unix:\/\//)
    for (const image of Object.values(images)) docker('image', 'inspect', image)
    const pg = launch('postgres', '/var/lib/postgresql/data', '5432', [
      `POSTGRES_DB=${namespace}`, `POSTGRES_USER=${user}`, `POSTGRES_PASSWORD=${password}`,
    ])
    const mq = launch('rabbit', '/var/lib/rabbitmq', '5672', [
      `RABBITMQ_DEFAULT_VHOST=${namespace}`, `RABBITMQ_DEFAULT_USER=${user}`,
      `RABBITMQ_DEFAULT_PASS=${password}`,
    ])
    pool = new Pool({ host: '127.0.0.1', port: pg.port, database: namespace,
      user, password, max: 4, connectionTimeoutMillis: 500 })
    let pgReady = false
    const deadline = Date.now() + 45_000
    while (Date.now() < deadline && !pgReady) {
      if (!pgReady) {
        try { await pool.query('SELECT 1'); pgReady = true } catch { /* Still starting. */ }
      }
      if (!pgReady) await delay(200)
    }
    expect(pgReady).toBe(true)
    inspect(pg.resource)
    inspect(mq.resource)
    const identity = (await pool.query('SELECT current_database() AS db,current_user AS role'))
      .rows[0]
    expect(identity).toEqual({ db: namespace, role: user })
    await pool.query(readFileSync(new URL(
      '../../../packages/prisma-client/prisma/migrations/0014_target_key_registry/migration.sql',
      import.meta.url,
    ), 'utf8'))
    await pool.query(`INSERT INTO target_key.commune(cog,initialized,source)
      VALUES('96001',true,'synthetic-service-fixture')`)

    const config: BrokerConfig = createRabbitConfig({
      hostname: '127.0.0.1', port: mq.port, user, password,
    }, namespace, prefix, 100)
    const scope = config.vhosts![namespace]
    const confirmed = { confirm: true, options: { mandatory: true, persistent: true } }
    scope.queues = { ...scope.queues,
      [`${prefix}.output`]: { options: { durable: true } },
      [`${prefix}.witness`]: { options: { durable: true } },
    }
    scope.bindings = { ...scope.bindings,
      fixtureOutput: { source: rabbitExchanges.pipeline, destination: `${prefix}.output`,
        bindingKey: routingKeys.balEnrichedTargetKey },
      fixtureWitness: { source: rabbitExchanges.pipeline, destination: `${prefix}.witness`,
        bindingKey: routingKeys.balEnrich },
    }
    scope.publications = { ...scope.publications,
      fixtureInput: { ...confirmed, exchange: rabbitExchanges.pipeline,
        routingKey: routingKeys.balEnrich },
      fixtureMissing: { ...confirmed, exchange: rabbitExchanges.pipeline,
        routingKey: 'fixture.unroutable' },
    }
    scope.subscriptions = { ...scope.subscriptions,
      fixtureOutput: { queue: `${prefix}.output`, prefetch: 1 },
      fixtureWitness: { queue: `${prefix}.witness`, prefetch: 1 },
      fixtureQuarantine: { queue: `${prefix}.dead-letter`, prefetch: 1 },
    }
    // Probe actual AMQP readiness, not the Docker TCP proxy or an Erlang CLI
    // that could create a cookie before the server. Close every partial broker.
    while (Date.now() < deadline && !broker) {
      try { broker = await rascal.BrokerAsPromised.create(config) } catch (error) {
        await shutdownFailedBroker(error)
        await delay(200)
      }
    }
    expect(broker).toBeDefined()
    if (!broker) throw new Error('Isolated AMQP service did not become ready')
    broker.on('error', () => record({ kind: 'broker-error', id: '' }))
    for (const [subscription, kind] of [
      ['fixtureOutput', 'output'], ['fixtureWitness', 'witness'],
      ['fixtureQuarantine', 'quarantine'],
    ]) {
      const session = await broker.subscribe(subscription)
      session.on('error', () => record({ kind: 'subscription-error', id: '' }))
      session.on('message', (_raw, content, ack) => {
        record({ kind, id: content.id ?? content.original?.id ?? '', content })
        ack()
      })
    }
    const registry = createRegistry(pool)
    const injected: Registry = { async resolve(input, select) {
      if (transient === input.id) {
        transient = undefined
        throw new Error('Synthetic transient registry failure')
      }
      return registry.resolve(input, select)
    } }
    const consumer = createConsumer(injected, broker)
    const session = await broker.subscribe(subscriptions.balToTargetKey)
    session.on('error', () => record({ kind: 'subscription-error', id: '' }))
    session.on('message', (raw, content, ack) => {
      void consumer(content, raw.properties.headers?.['target-key-attempts'],
        (error?: Error, recovery?: Recovery) => {
          record({ kind: error ? 'nack' : 'ack', id: content.id,
            attempts: raw.properties.headers?.['target-key-attempts'] })
          return ack(error, recovery)
        }).catch(() => record({ kind: 'consumer-error', id: content.id }))
    })
  }, 60_000)

  afterAll(async () => {
    try { await broker?.shutdown() } finally {
      try { await pool?.end() } finally {
        for (const container of [...containers].reverse()) {
          inspect(container)
          docker('rm', '--force', container.id)
        }
      }
    }
  }, 30_000)

  it('publishes and replays without duplicate allocations', async () => {
    const content = message('real-nominal')
    await send(content)
    await observed('output', content.id)
    await observed('ack', content.id)
    const output = records.find(value => value.kind === 'output' && value.id === content.id)!
    expect(output.content).toMatchObject({ rows: [{
      ban_enrich_retained_cle_interop: expect.stringMatching(/^96001_[a-z0-9]{6}_00012$/),
      ban_enrich_ban_target_keys_address: ['96001~VOIE-DE-TEST~12'],
    }] })
    const count = (await pool!.query('SELECT count(*) FROM target_key.code')).rows[0].count
    await send(content)
    await observed('output', content.id, 2)
    await observed('ack', content.id, 2)
    expect((await pool!.query('SELECT count(*) FROM target_key.code')).rows[0].count).toBe(count)
    expect(records.filter(value => value.kind === 'output' && value.id === content.id)[1].content)
      .toEqual(output.content)
  })

  it('routes a delayed retry only to target-key, then confirms success', async () => {
    transient = 'real-retry'
    await send(message(transient, 'Voie de reprise'))
    await observed('ack', 'real-retry', 2)
    await observed('output', 'real-retry')
    await observed('witness', 'real-retry')
    expect(records.filter(value => value.kind === 'witness' && value.id === 'real-retry'))
      .toHaveLength(1)
    expect(records.filter(value => value.kind === 'ack' && value.id === 'real-retry')
      .map(value => value.attempts)).toEqual([undefined, 1])
  })

  it('quarantines invalid content before acknowledging', async () => {
    await send({ id: 'real-invalid', rows: [] })
    await observed('quarantine', 'real-invalid')
    await observed('ack', 'real-invalid')
    expect(records.some(value => value.kind === 'output' && value.id === 'real-invalid'))
      .toBe(false)
  })

  it('requeues when both result and recovery cannot route', async () => {
    const unroutable: PublishBroker = {
      config: broker!.config,
      publish: (_name, content, options) => broker!.publish('fixtureMissing', content, options),
    }
    await expect(publishConfirmed(broker!, 'fixtureMissing', {})).rejects.toThrow(/not confirmed/)
    const ack = vi.fn()
    await createConsumer(createRegistry(pool!), unroutable)(message('real-unroutable'), 0, ack)
    expect(ack).toHaveBeenCalledExactlyOnceWith(expect.any(Error), {
      strategy: 'nack', requeue: true, defer: 5_000,
    })
    expect(ack).not.toHaveBeenCalledWith()
    expect((await pool!.query('SELECT count(*) FROM target_key.request WHERE id=$1',
      ['real-unroutable'])).rows[0].count).toBe('1')
    expect(records.filter(value => value.kind.endsWith('error'))).toEqual([])
  })
})
