import {
  connectionConfig,
  legacyRabbitExchanges,
  legacyRabbitQueues,
  publishOptions,
  queueOptions,
  routingKeys,
  subscriptionDefaults,
  type RabbitMqBrokerConfig,
} from '@ban/rabbitmq';

const exchangeName = legacyRabbitExchanges.balEvents;
const queueName = legacyRabbitQueues.serviceInput('target-key');

export const subscriptions = {
  balToTargetKey: 'balToTargetKey',
} as const;

export const publications = {
  withTargetKey: 'withTargetKey',
} as const;

export const rabbitmqConfig = {
  vhosts: {
    '/': {
      connection: connectionConfig,
      exchanges: {
        [exchangeName]: {
          type: 'topic',
          assert: true,
          options: {
            durable: true,
          },
        },
      },
      queues: {
        [queueName]: {
          assert: true,
          options: queueOptions,
        },
      },
      bindings: {
        [`${exchangeName}[${routingKeys.balEnrich}] -> ${queueName}`]: {
          source: exchangeName,
          destination: queueName,
          bindingKey: routingKeys.balEnrich,
        },
      },
      subscriptions: {
        [subscriptions.balToTargetKey]: {
          queue: queueName,
          ...subscriptionDefaults,
        },
      },
      publications: {
        [publications.withTargetKey]: {
          exchange: exchangeName,
          routingKey: routingKeys.balEnrichedTargetKey,
          options: publishOptions,
        },
      },
    },
  },
} satisfies RabbitMqBrokerConfig;
