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
const queueName = legacyRabbitQueues.serviceInput('parser');

export const subscriptions = {
  balUploaded: 'balUploaded',
} as const;

export const publications = {
  balParsed: 'balParsed',
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
        [`${exchangeName}[${routingKeys.balUploaded}] -> ${queueName}`]: {
          source: exchangeName,
          destination: queueName,
          bindingKey: routingKeys.balUploaded,
        },
      },
      subscriptions: {
        [subscriptions.balUploaded]: {
          queue: queueName,
          ...subscriptionDefaults,
        },
      },
      publications: {
        [publications.balParsed]: {
          exchange: exchangeName,
          routingKey: routingKeys.balParsed,
          options: publishOptions,
        },
      },
    },
  },
} satisfies RabbitMqBrokerConfig;
