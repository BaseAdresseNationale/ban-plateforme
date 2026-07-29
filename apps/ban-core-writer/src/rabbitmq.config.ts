import {
  connectionConfig,
  exchangesConfig,
  queueOptions,
  rabbitExchanges,
  rabbitQueues,
  routingKeys,
  subscriptionDefaults,
  type RabbitMqBrokerConfig,
} from '@ban/rabbitmq';

const exchangeName = rabbitExchanges.pipeline;
const queueName = rabbitQueues.service('writer');

export const subscriptions = {
  balReady: 'balReady',
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
        [`${exchangeName}[${routingKeys.balReady}] -> ${queueName}`]: {
          source: exchangeName,
          destination: queueName,
          bindingKey: routingKeys.balReady,
        },
      },
      subscriptions: {
        [subscriptions.balReady]: {
          queue: queueName,
          ...subscriptionDefaults,
        },
      },
    },
  },
} satisfies RabbitMqBrokerConfig;
