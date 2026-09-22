import {
  connectionConfig,
  exchangesConfig,
  publishOptions,
  queueOptions,
  rabbitExchanges,
  rabbitQueues,
  routingKeys,
  subscriptionDefaults,
  type RabbitMqBrokerConfig,
} from '@ban/rabbitmq';

const exchangeName = rabbitExchanges.pipeline;
const queueName = rabbitQueues.service('target-key');

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
        [exchangeName]: exchangesConfig.pipeline,
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
