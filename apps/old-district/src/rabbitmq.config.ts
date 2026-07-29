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
const queueName = legacyRabbitQueues.serviceInput('old-district');

export const subscriptions = {
  balToOldDistrict: 'balToOldDistrict',
} as const;

export const publications = {
  withOldDistrict: 'withOldDistrict',
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
        [subscriptions.balToOldDistrict]: {
          queue: queueName,
          ...subscriptionDefaults,
        },
      },
      publications: {
        [publications.withOldDistrict]: {
          exchange: exchangeName,
          routingKey: routingKeys.balEnrichedOldDistrict,
          options: publishOptions,
        },
      },
    },
  },
} satisfies RabbitMqBrokerConfig;
