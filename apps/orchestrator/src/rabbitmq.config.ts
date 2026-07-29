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
const queueName = legacyRabbitQueues.serviceInput('orchestrator');

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
