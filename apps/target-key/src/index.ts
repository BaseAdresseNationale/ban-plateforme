import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { Pool } from 'pg'
import rascal from 'rascal'

import { createConsumer } from './consumer.js'
import { createRabbitConfig, subscriptions } from './rabbitmq.config.js'
import { createRegistry } from './registry.js'

interface Runtime {
  loadPool?: () => Promise<Pool>
  createBroker?: typeof rascal.BrokerAsPromised.create
  report?: (event: string) => void
}

/** Rascal20 attaches its partially initialized broker under a symbol on creation errors. */
export const shutdownFailedBroker = async (error: unknown) => {
  if (!error || typeof error !== 'object' || !('broker' in error)
    || typeof error.broker !== 'symbol') return
  const partial = (error as Record<symbol, unknown>)[error.broker]
  if (partial && typeof partial === 'object' && 'shutdown' in partial
    && typeof partial.shutdown === 'function') await partial.shutdown()
}

export const startTargetKey = async (runtime: Runtime = {}) => {
  const environment = process.env
  const required = (name: string) => {
    const value = environment[name]
    if (!value) throw new Error('Missing target-key runtime configuration')
    return value
  }
  const port = Number(required('RABBITMQ_PORT'))
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid target-key broker port')
  }
  try {
    const url = new URL(required('PG_URL'))
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname
      || !decodeURIComponent(url.pathname.slice(1)).trim()) {
      throw new Error('Invalid PostgreSQL URL')
    }
  } catch {
    throw new Error('Invalid target-key database configuration')
  }
  const config = createRabbitConfig({
    protocol: 'amqp', hostname: required('RABBITMQ_HOST'), port,
    user: required('RABBITMQ_USER'), password: required('RABBITMQ_PASSWORD'),
  }, environment.RABBITMQ_VHOST || '/')
  // Reuse the shared pool, instantiated only during explicit service startup.
  const loadPool = runtime.loadPool ?? (async () => (await import('@ban/prisma-client')).pool)
  const pool = await loadPool()
  const report = runtime.report ?? ((event: string) => console.info(`target-key: ${event}`))
  let broker: Awaited<ReturnType<typeof rascal.BrokerAsPromised.create>> | undefined
  try {
    broker = await (runtime.createBroker ?? rascal.BrokerAsPromised.create)(config)
    broker.on('error', () => report('broker-unavailable'))
    const consumer = createConsumer(createRegistry(pool), broker, report)
    const subscription = await broker.subscribe(subscriptions.balToTargetKey)
    subscription.on('error', () => report('subscription-unavailable'))
    subscription.on('message', (message, content, ack) => {
      void consumer(content, message.properties.headers?.['target-key-attempts'], ack)
        .catch(() => report('acknowledgement-failed'))
    })
    const active = broker
    let stopping: Promise<void> | undefined
    return () => stopping ??= (async () => {
      try {
        await active.shutdown()
      } finally {
        await pool.end()
      }
    })()
  } catch (error) {
    try {
      if (broker) await broker.shutdown()
      else await shutdownFailedBroker(error)
    } finally {
      await pool.end()
    }
    throw new Error('Target-key startup failed')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  startTargetKey().then(stop => {
    const shutdown = () => {
      void stop().catch(() => {
        console.error('target-key: shutdown failed')
        process.exitCode = 1
      })
    }
    process.once('SIGINT', shutdown)
    process.once('SIGTERM', shutdown)
  }).catch(() => {
    console.error('target-key: startup failed')
    process.exitCode = 1
  })
}
