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
const queueName = rabbitQueues.service('orchestrator');

export const subscriptions = {
  balParsed: 'balParsed',
} as const;

export const publications = {
  fanoutEnrichments: 'fanout.enrichments',
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
        [`${exchangeName}[${routingKeys.balParsed}] -> ${queueName}`]: {
          source: exchangeName,
          destination: queueName,
          bindingKey: routingKeys.balParsed,
        },
      },
      subscriptions: {
        [subscriptions.balParsed]: {
          queue: queueName,
          ...subscriptionDefaults,
        },
      },
      publications: {
        [publications.fanoutEnrichments]: {
          exchange: exchangeName,
          routingKey: routingKeys.balEnrich,
          options: publishOptions,
        },
      },
    },
  },
} satisfies RabbitMqBrokerConfig;
