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
const queueName = legacyRabbitQueues.serviceInput('beautifier');

export const subscriptions = {
  balToBeautify: 'balToBeautify',
} as const;

export const publications = {
  beautified: 'beautified',
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
        [subscriptions.balToBeautify]: {
          queue: queueName,
          ...subscriptionDefaults,
        },
      },
      publications: {
        [publications.beautified]: {
          exchange: exchangeName,
          routingKey: routingKeys.balBeautified,
          options: publishOptions,
        },
      },
    },
  },
} satisfies RabbitMqBrokerConfig;
