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
const queueName = rabbitQueues.service('merger');

export const subscriptions = {
  balEnriched: 'balEnriched',
} as const;

export const publications = {
  ready: 'ready',
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
        [`${exchangeName}[${routingKeys.balEnrichedAll}] -> ${queueName}`]: {
          source: exchangeName,
          destination: queueName,
          bindingKey: routingKeys.balEnrichedAll,
        },
      },
      subscriptions: {
        [subscriptions.balEnriched]: {
          queue: queueName,
          ...subscriptionDefaults,
        },
      },
      publications: {
        [publications.ready]: {
          exchange: exchangeName,
          routingKey: routingKeys.balReady,
          options: publishOptions,
        },
      },
    },
  },
} satisfies RabbitMqBrokerConfig;
