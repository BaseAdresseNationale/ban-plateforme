import { EventEmitter } from 'node:events'

import { describe, expect, it, vi } from 'vitest'

import { createConsumer } from './consumer.js'
import type { Registry } from './consumer.js'
import { publications } from './rabbitmq.config.js'

const content = { id: 'synthetic-consumer', rows: [{
  __balRowIndex: 0, commune_insee: '96001', voie_nom: 'Voie fictive', numero: '12',
  cle_interop: '96002_a001_00012_bis_a',
}] }

const fixture = () => {
  const sessions: EventEmitter[] = []
  const broker = {
    config: { publications: Object.fromEntries(Object.values(publications).map(name => [name, {
      confirm: true, options: { mandatory: true, persistent: true },
    }])) },
    publish: vi.fn(async (_name: string, _content: unknown,
      _options?: { options: { headers: Record<string, unknown> } }) => {
      const session = Object.assign(new EventEmitter(), { abort: vi.fn() })
      sessions.push(session)
      return session
    }),
  }
  const registry: Registry = {
    async resolve(input, select) { return select({ [input.rowKeys[0]]: 'abc123' }); },
  }
  const ack = vi.fn()
  const report = vi.fn()
  return { broker, registry, sessions, ack, report }
}
const until = async (condition: () => boolean) => {
  for (let i = 0; i < 20 && !condition(); i++) await Promise.resolve()
  expect(condition()).toBe(true)
}

describe('real target-key consumer contract', () => {
  it('publishes the registry result before acknowledging', async () => {
    const test = fixture()
    const task = createConsumer(test.registry, test.broker)(content, 0, test.ack)
    await until(() => test.sessions.length === 1)
    expect(test.ack).not.toHaveBeenCalled()
    expect(test.broker.publish.mock.calls[0][0]).toBe(publications.withTargetKey)
    const payload = test.broker.publish.mock.calls[0][1]
    expect(payload).toMatchObject({ rows: [{
      cle_interop: '96002_a001_00012_bis_a',
      ban_enrich_retained_cle_interop: '96002_a001_00012_bis_a',
    }] })
    expect(payload).not.toHaveProperty('rows.0.ban_enrich_deprecated_cle_interop')
    test.sessions[0].emit('success')
    await task
    expect(test.ack).toHaveBeenCalledExactlyOnceWith()
  })

  it('retries a transient error through a confirmed retry publication', async () => {
    const test = fixture()
    test.registry.resolve = async () => { throw new Error('private fixture detail'); }
    const task = createConsumer(test.registry, test.broker, test.report)(content, 1, test.ack)
    await until(() => test.sessions.length === 1)
    expect(test.broker.publish.mock.calls[0][0]).toBe(publications.retry)
    expect(test.broker.publish.mock.calls[0][2]).toEqual({
      options: { headers: { 'target-key-attempts': 2 } },
    })
    expect(test.ack).not.toHaveBeenCalled()
    test.sessions[0].emit('success'); await task
    expect(test.ack).toHaveBeenCalledExactlyOnceWith()
    expect(test.report).toHaveBeenCalledWith('retry-confirmed')
  })

  it('quarantines invalid input without publishing a success or logging its body', async () => {
    const test = fixture()
    const task = createConsumer(test.registry, test.broker, test.report)({}, 0, test.ack)
    await until(() => test.sessions.length === 1)
    expect(test.broker.publish.mock.calls[0][0]).toBe(publications.failed)
    test.sessions[0].emit('success'); await task
    expect(test.report).toHaveBeenCalledExactlyOnceWith('quarantine-confirmed')
    expect(test.ack).toHaveBeenCalledExactlyOnceWith()
  })

  it('retains the original for requeue if even the retry publication fails', async () => {
    const test = fixture()
    test.registry.resolve = async () => { throw new Error('fixture database unavailable'); }
    const task = createConsumer(test.registry, test.broker)(content, 0, test.ack)
    await until(() => test.sessions.length === 1)
    test.sessions[0].emit('return'); await task
    expect(test.ack).toHaveBeenCalledWith(expect.any(Error), {
      strategy: 'nack', requeue: true, defer: 5_000,
    })
    expect(test.ack).not.toHaveBeenCalledWith()
  })

  it('quarantines after three attempts rather than retrying without bound', async () => {
    const test = fixture()
    test.registry.resolve = async () => { throw new Error('fixture database unavailable'); }
    const task = createConsumer(test.registry, test.broker)(content, 3, test.ack)
    await until(() => test.sessions.length === 1)
    expect(test.broker.publish.mock.calls[0][0]).toBe(publications.failed)
    test.sessions[0].emit('success'); await task
  })

  it('does not republish when the acknowledgement callback throws', async () => {
    const test = fixture()
    test.ack.mockImplementation(() => { throw new Error('synthetic ACK failure') })
    const task = createConsumer(test.registry, test.broker)(content, 0, test.ack)
    const assertion = expect(task).rejects.toThrow('synthetic ACK failure')
    await until(() => test.sessions.length === 1)
    test.sessions[0].emit('success')
    await assertion
    expect(test.broker.publish).toHaveBeenCalledOnce()
  })
})
