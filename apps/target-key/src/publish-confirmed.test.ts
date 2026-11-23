import { EventEmitter } from 'node:events'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { PublicationFailed, publishConfirmed } from './publish-confirmed.js'

const fixture = () => {
  const session = Object.assign(new EventEmitter(), { abort: vi.fn() })
  const broker = { config: { publications: { fixture: {
    confirm: true, options: { mandatory: true, persistent: true },
  } } }, publish: vi.fn(async () => session) }
  return { session, broker }
}

afterEach(() => vi.useRealTimers())

describe('confirmed and routed publication', () => {
  it('does not resolve merely because a publication session was created', async () => {
    const { broker, session } = fixture()
    const completed = vi.fn()
    const promise = publishConfirmed(broker, 'fixture', {}).then(completed)
    await Promise.resolve()
    expect(completed).not.toHaveBeenCalled()
    session.emit('success', 'synthetic-message')
    await promise
    expect(completed).toHaveBeenCalledOnce()
    session.emit('error', new Error('late fixture error'))
  })

  it.each(['error', 'return', 'close'])('rejects %s without a false success', async event => {
    const { broker, session } = fixture()
    const promise = publishConfirmed(broker, 'fixture', {})
    const assertion = expect(promise).rejects.toBeInstanceOf(PublicationFailed)
    await Promise.resolve()
    session.emit(event, new Error('fixture failure'))
    session.emit('success', 'synthetic-message')
    await assertion
  })

  it('handles a return in the same event turn as success', async () => {
    const { broker, session } = fixture()
    const promise = publishConfirmed(broker, 'fixture', {})
    const assertion = expect(promise).rejects.toBeInstanceOf(PublicationFailed)
    await Promise.resolve()
    session.emit('success'); session.emit('return')
    await assertion
  })

  it('requires confirm/mandatory/persistent before publishing', async () => {
    const { broker } = fixture()
    broker.config.publications.fixture.confirm = false
    await expect(publishConfirmed(broker, 'fixture', {})).rejects.toBeInstanceOf(PublicationFailed)
    expect(broker.publish).not.toHaveBeenCalled()
  })

  it('bounds a paused or unconfirmed session using fake time', async () => {
    vi.useFakeTimers()
    const { broker, session } = fixture()
    const promise = publishConfirmed(broker, 'fixture', {}, {}, 100)
    const assertion = expect(promise).rejects.toBeInstanceOf(PublicationFailed)
    await vi.advanceTimersByTimeAsync(100)
    await assertion
    expect(session.abort).toHaveBeenCalledOnce()
  })
})
