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
const queueName = legacyRabbitQueues.serviceInput('merger');

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
