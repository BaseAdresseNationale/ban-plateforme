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
const queueName = rabbitQueues.service('old-district');

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
