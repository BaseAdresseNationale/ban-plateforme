import type { EventEmitter } from 'node:events'

export interface PublishBroker {
  config: unknown
  publish(
    name: string, content: unknown,
    options?: { options: { headers: Record<string, unknown> } },
  ): Promise<EventEmitter & { abort(): void }>
}

export class PublicationFailed extends Error {
  constructor() {
    super('Target-key publication was not confirmed and routed')
    this.name = 'PublicationFailed'
  }
}

export const publishConfirmed = async (
  broker: PublishBroker, name: string, content: unknown,
  headers: Record<string, unknown> = {}, timeoutMs = 15_000,
): Promise<void> => {
  const config = broker.config as {
    publications?: Record<string, { confirm?: boolean; options?: {
      mandatory?: boolean; persistent?: boolean
    } }>
  }
  const publication = config?.publications?.[name]
  if (publication?.confirm !== true || publication.options?.mandatory !== true
    || publication.options?.persistent !== true) throw new PublicationFailed()
  const session = await broker.publish(name, content, { options: { headers } })
  await new Promise<void>((resolve, reject) => {
    let settled = false
    const finish = (failed: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      session.removeListener('success', success)
      session.removeListener('return', failure)
      session.removeListener('close', failure)
      // Keep an error handler for events arriving after settlement.
      failed ? reject(new PublicationFailed()) : resolve()
    }
    const failure = () => finish(true)
    const success = () => queueMicrotask(() => finish(false))
    const timer = setTimeout(() => {
      failure()
      try { session.abort() } catch { /* The original remains unacknowledged. */ }
    }, timeoutMs)
    session.on('success', success)
    session.on('return', failure)
    session.on('error', failure)
    session.on('close', failure)
  })
}
