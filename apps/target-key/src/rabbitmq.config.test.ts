import { describe, expect, it } from 'vitest'

import { createRabbitConfig, publications, subscriptions } from './rabbitmq.config.js'

describe('target-key scoped topology', () => {
  it('preserves the input queue arguments and routes delayed retries only to that queue', () => {
    const config = createRabbitConfig({ hostname: '127.0.0.1', port: 1 }, 'synthetic-vhost')
    const vhost = config.vhosts!['synthetic-vhost']
    expect(vhost.queues!['ban.target-key'].options).toEqual({ durable: true })
    expect(vhost.queues!['ban.target-key.retry'].options).toEqual({
      durable: true, messageTtl: 30_000, deadLetterExchange: '',
      deadLetterRoutingKey: 'ban.target-key',
    })
    expect(vhost.queues!['ban.target-key.dead-letter'].options).toEqual({ durable: true })
    expect(vhost.subscriptions![subscriptions.balToTargetKey].prefetch).toBe(1)
    for (const name of Object.values(publications)) {
      expect(vhost.publications![name]).toMatchObject({
        confirm: true, options: { mandatory: true, persistent: true },
      })
    }
  })
})
