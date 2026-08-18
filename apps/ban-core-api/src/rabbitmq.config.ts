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

const commandsExchangeName = rabbitExchanges.commands;
const pipelineExchangeName = rabbitExchanges.pipeline;
const parserQueueName = rabbitQueues.service('parser');

export const publications = {
  default: 'default',
  legacyBalUploaded: routingKeys.balUploaded,
  balUploaded: 'balUploaded',
  exportRequested: 'exportRequested',
} as const;

const balUploadedPublication = {
  exchange: pipelineExchangeName,
  routingKey: routingKeys.balUploaded,
  options: publishOptions,
} as const;

const exportRequestedPublication = {
  exchange: commandsExchangeName,
  routingKey: routingKeys.exportRequested,
  options: publishOptions,
} as const;

export const rabbitmqConfig = {
  vhosts: {
    '/': {
      connection: connectionConfig,
      exchanges: {
        [commandsExchangeName]: exchangesConfig.commands,
        [pipelineExchangeName]: exchangesConfig.pipeline,
      },
      queues: {
        [parserQueueName]: {
          assert: true,
          options: queueOptions,
        },
      },
      bindings: {
        [`${pipelineExchangeName}[${routingKeys.balUploaded}] -> ${parserQueueName}`]: {
          source: pipelineExchangeName,
          destination: parserQueueName,
          bindingKey: routingKeys.balUploaded,
        },
      },
      publications: {
        [publications.default]: { ...balUploadedPublication },
        [publications.legacyBalUploaded]: { ...balUploadedPublication },
        [publications.balUploaded]: { ...balUploadedPublication },
        [publications.exportRequested]: { ...exportRequestedPublication },
      },
    },
  },
} satisfies RabbitMqBrokerConfig;
