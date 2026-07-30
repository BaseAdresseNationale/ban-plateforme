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

// Remplacez `service-name` par le nom technique du microservice.
// La queue sera nommée `ban.<service-name>` via la convention partagée.
const queueName = rabbitQueues.service('service-name');

export const subscriptions = {
  // Nom local utilisé par `broker.subscribe(...)` dans `index.ts`.
  messageToProcess: 'messageToProcess',
} as const;

export const publications = {
  // Nom local utilisé par `broker.publish(...)` dans `index.ts`.
  messageProcessed: 'message.processed',
} as const;

export const rabbitmqConfig = {
  vhosts: {
    '/': {
      connection: connectionConfig,
      exchanges: {
        [exchangeName]: exchangesConfig.pipeline,
      },
      queues: {
        // Queue principale consommée par ce microservice.
        [queueName]: {
          assert: true,
          options: queueOptions,
        },
      },
      bindings: {
        // Adaptez la routing key consommée selon le rôle du service.
        [`${exchangeName}[${routingKeys.balEnrich}] -> ${queueName}`]: {
          source: exchangeName,
          destination: queueName,
          bindingKey: routingKeys.balEnrich,
        },
      },
      subscriptions: {
        [subscriptions.messageToProcess]: {
          queue: queueName,
          ...subscriptionDefaults,
        },
      },
      publications: {
        // Adaptez la routing key publiée selon le message produit par le service.
        [publications.messageProcessed]: {
          exchange: exchangeName,
          routingKey: routingKeys.balReady,
          options: publishOptions,
        },
      },
    },
  },
} satisfies RabbitMqBrokerConfig;
