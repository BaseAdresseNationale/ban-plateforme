import {
  connectionConfig,
  exchangesConfig,
  publishOptions,
  queueOptions,
  rabbitExchanges,
  rabbitQueues,
  routingKeys,
  type RabbitMqBrokerConfig,
} from '@ban/rabbitmq';

const exchangeName = rabbitExchanges.pipeline;
const parserQueueName = rabbitQueues.service('parser');

export const publications = {
  default: 'default',
  legacyBalUploaded: routingKeys.balUploaded,
  balUploaded: 'balUploaded',
} as const;

const balUploadedPublication = {
  exchange: exchangeName,
  routingKey: routingKeys.balUploaded,
  options: publishOptions,
} as const;

export const rabbitmqConfig = {
  vhosts: {
    '/': {
      connection: connectionConfig,
      exchanges: {
        [exchangeName]: exchangesConfig.pipeline,
      },
      queues: {
        [parserQueueName]: {
          assert: true,
          options: queueOptions,
        },
      },
      bindings: {
        [`${exchangeName}[${routingKeys.balUploaded}] -> ${parserQueueName}`]: {
          source: exchangeName,
          destination: parserQueueName,
          bindingKey: routingKeys.balUploaded,
        },
      },
      publications: {
        [publications.default]: { ...balUploadedPublication },
        [publications.legacyBalUploaded]: { ...balUploadedPublication },
        [publications.balUploaded]: { ...balUploadedPublication },
      },
    },
  },
} satisfies RabbitMqBrokerConfig;
