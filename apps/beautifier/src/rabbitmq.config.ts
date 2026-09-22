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
const queueName = rabbitQueues.service('beautifier');

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
