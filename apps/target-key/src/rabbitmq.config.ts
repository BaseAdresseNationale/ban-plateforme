import {
  exchangesConfig, publishOptions, queueOptions, rabbitExchanges,
  rabbitQueues, routingKeys, subscriptionDefaults,
} from '@ban/rabbitmq/pipeline'
import type { ConnectionConfig, RabbitMqBrokerConfig } from '@ban/rabbitmq/pipeline'

export const subscriptions = { balToTargetKey: 'balToTargetKey' } as const
export const publications = {
  withTargetKey: 'withTargetKey', retry: 'targetKeyRetry', failed: 'targetKeyFailed',
} as const

export const createRabbitConfig = (
  connection: ConnectionConfig, vhost = '/', queue = rabbitQueues.service('target-key'),
  retryDelayMs = 30_000,
) => {
  if (!Number.isSafeInteger(retryDelayMs) || retryDelayMs < 1) {
    throw new Error('Invalid target-key retry delay')
  }
  const retry = `${queue}.retry`
  const failed = `${queue}.dead-letter`
  const confirmed = { confirm: true, options: { ...publishOptions, mandatory: true } }
  return {
    vhosts: {
      [vhost]: {
        connection,
        exchanges: { [rabbitExchanges.pipeline]: exchangesConfig.pipeline },
        queues: {
          [queue]: { assert: true, options: queueOptions },
          [retry]: {
            assert: true,
            options: {
              ...queueOptions, messageTtl: retryDelayMs,
              deadLetterExchange: '', deadLetterRoutingKey: queue,
            },
          },
          [failed]: { assert: true, options: queueOptions },
        },
        bindings: {
          targetKeyInput: {
            source: rabbitExchanges.pipeline, destination: queue,
            bindingKey: routingKeys.balEnrich,
          },
        },
        subscriptions: {
          [subscriptions.balToTargetKey]: { queue, ...subscriptionDefaults },
        },
        publications: {
          [publications.withTargetKey]: {
            ...confirmed, exchange: rabbitExchanges.pipeline,
            routingKey: routingKeys.balEnrichedTargetKey,
          },
          [publications.retry]: { ...confirmed, queue: retry },
          [publications.failed]: { ...confirmed, queue: failed },
        },
      },
    },
  } satisfies RabbitMqBrokerConfig
}
