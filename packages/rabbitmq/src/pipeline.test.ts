import { describe, expect, it, vi } from 'vitest'

vi.mock('dotenv', () => { throw new Error('Pure entry must not load dotenv'); })

describe('pure pipeline entry', () => {
  it('exposes existing names and defaults without environment initialization', async () => {
    const pipeline = await import('./pipeline.js')
    expect(pipeline.routingKeys.balEnrichedTargetKey).toBe('bal.enriched.target-key')
    expect(pipeline.rabbitQueues.service('target-key')).toBe('ban.target-key')
    expect(pipeline.queueOptions).toEqual({ durable: true })
  })
})
