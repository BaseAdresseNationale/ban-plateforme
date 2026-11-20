import type { Recovery } from 'rascal'

import { enrichMessage, InvalidTargetKeyInput, prepareMessage } from './keys.js'
import type { PreparedMessage } from './keys.js'
import { publishConfirmed } from './publish-confirmed.js'
import type { PublishBroker } from './publish-confirmed.js'
import { publications } from './rabbitmq.config.js'
import { RegistryUnavailable } from './registry.js'

export interface Registry {
  resolve<T>(input: PreparedMessage, select: (codes: Record<string, string>) => T): Promise<T>
}

export const createConsumer = (
  registry: Registry, broker: PublishBroker, report: (event: string) => void = () => {},
) => async (
  content: unknown, attempts: unknown,
  ack: (error?: Error, recovery?: Recovery) => unknown,
): Promise<void> => {
  let failure: unknown
  let succeeded = false
  try {
    const input = prepareMessage(content)
    const result = await registry.resolve(input, codes => enrichMessage(input, codes))
    await publishConfirmed(broker, publications.withTargetKey, result)
    succeeded = true
  } catch (error) {
    failure = error
  }
  if (succeeded) {
    await ack()
    return
  }
  const count = Number.isInteger(attempts) && Number(attempts) >= 0 ? Number(attempts) : 0
  const fatal = failure instanceof InvalidTargetKeyInput || failure instanceof RegistryUnavailable
  try {
    if (!fatal && count < 3) {
      await publishConfirmed(broker, publications.retry, content, {
        'target-key-attempts': count + 1,
      })
      report('retry-confirmed')
    } else {
      await publishConfirmed(broker, publications.failed, {
        reason: fatal ? 'invalid-or-unavailable-input' : 'retry-exhausted', original: content,
      })
      report('quarantine-confirmed')
    }
  } catch {
    report('retry-publication-failed')
    await ack(new Error('Target-key processing requires retry'), {
      strategy: 'nack', requeue: true, defer: 5_000,
    })
    return
  }
  await ack()
}
