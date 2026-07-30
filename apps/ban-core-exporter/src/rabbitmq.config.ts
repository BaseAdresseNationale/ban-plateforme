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

const commandsExchangeName = rabbitExchanges.commands;
const eventsExchangeName = rabbitExchanges.events;
const queueName = rabbitQueues.service('exporter');

export const subscriptions = {
  exportRequested: 'export.requested',
} as const;

export const publications = {
  exportCompleted: 'export.completed',
  exportFailed: 'export.failed',
} as const;

export const rabbitmqConfig = {
  vhosts: {
    '/': {
      connection: connectionConfig,
      exchanges: {
        [commandsExchangeName]: exchangesConfig.commands,
        [eventsExchangeName]: exchangesConfig.events,
      },
      queues: {
        [queueName]: {
          assert: true,
          options: queueOptions,
        },
      },
      bindings: {
        [`${commandsExchangeName}[${routingKeys.exportRequested}] -> ${queueName}`]: {
          source: commandsExchangeName,
          destination: queueName,
          bindingKey: routingKeys.exportRequested,
        },
      },
      subscriptions: {
        [subscriptions.exportRequested]: {
          queue: queueName,
          ...subscriptionDefaults,
        },
      },
      publications: {
        [publications.exportCompleted]: {
          exchange: eventsExchangeName,
          routingKey: routingKeys.exportCompleted,
          options: publishOptions,
        },
        [publications.exportFailed]: {
          exchange: eventsExchangeName,
          routingKey: routingKeys.exportFailed,
          options: publishOptions,
        },
      },
    },
  },
} satisfies RabbitMqBrokerConfig;
