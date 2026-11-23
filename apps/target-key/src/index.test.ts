import { EventEmitter } from 'node:events'

import type { Pool } from 'pg'
import type rascal from 'rascal'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@ban/prisma-client', () => { throw new Error('Database import is not allowed'); })
vi.mock('dotenv', () => { throw new Error('Environment-file loading is not allowed'); })

describe('target-key explicit bootstrap', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('imports without loading configuration, a pool or a network listener', async () => {
    const module = await import('./index.js')
    expect(module.startTargetKey).toBeTypeOf('function')
  })

  it('rejects missing runtime settings before accessing a database', async () => {
    vi.stubEnv('RABBITMQ_PORT', '')
    const { startTargetKey } = await import('./index.js')
    await expect(startTargetKey({})).rejects.toThrow('Missing target-key runtime configuration')
  })

  const runtime = () => {
    for (const [key, value] of Object.entries({
      RABBITMQ_PORT: '5672', RABBITMQ_HOST: '127.0.0.1', RABBITMQ_USER: 'test',
      RABBITMQ_PASSWORD: 'test-only', PG_URL: 'postgresql://test:test@127.0.0.1:1/test',
    })) vi.stubEnv(key, value)
    const end = vi.fn(async () => {})
    const pool = { end } as unknown as Pool
    const subscription = new EventEmitter()
    const broker = Object.assign(new EventEmitter(), {
      shutdown: vi.fn(async () => {}), subscribe: vi.fn(async () => subscription),
    })
    const createBroker = vi.fn(async () => broker) as unknown as
      typeof rascal.BrokerAsPromised.create
    return { end, broker, createBroker, loadPool: vi.fn(async () => pool) }
  }

  it.each([
    '', 'not-a-url', 'http://127.0.0.1/test', 'postgresql://127.0.0.1',
    'postgresql:///test', 'postgresql://127.0.0.1/%20',
  ])('rejects an invalid database destination before loading any pool (%s)', async value => {
    const fixture = runtime()
    vi.stubEnv('PG_URL', value)
    const { startTargetKey } = await import('./index.js')
    await expect(startTargetKey(fixture))
      .rejects.toThrow('Invalid target-key database configuration')
    expect(fixture.loadPool).not.toHaveBeenCalled()
    expect(fixture.createBroker).not.toHaveBeenCalled()
  })

  it('closes its resources once on explicit shutdown', async () => {
    const fixture = runtime()
    const { startTargetKey } = await import('./index.js')
    const stop = await startTargetKey(fixture)
    await Promise.all([stop(), stop()])
    expect(fixture.end).toHaveBeenCalledOnce()
    expect(fixture.broker.shutdown).toHaveBeenCalledOnce()
  })

  it('closes its pool and broker when subscription setup fails', async () => {
    const fixture = runtime()
    fixture.broker.subscribe.mockRejectedValueOnce(new Error('synthetic failure'))
    const { startTargetKey } = await import('./index.js')
    await expect(startTargetKey(fixture)).rejects.toThrow('Target-key startup failed')
    expect(fixture.end).toHaveBeenCalledOnce()
    expect(fixture.broker.shutdown).toHaveBeenCalledOnce()
  })

  it('closes the partial broker attached by Rascal20 when creation rejects', async () => {
    const fixture = runtime()
    const symbol = Symbol('broker-as-promised')
    const error = Object.assign(new Error('synthetic setup failure'), { broker: symbol })
    Object.defineProperty(error, symbol, { value: fixture.broker })
    const createBroker = vi.fn(async () => { throw error })
    const { startTargetKey } = await import('./index.js')
    await expect(startTargetKey({ ...fixture, createBroker }))
      .rejects.toThrow('Target-key startup failed')
    expect(fixture.end).toHaveBeenCalledOnce()
    expect(fixture.broker.shutdown).toHaveBeenCalledOnce()
  })
})
