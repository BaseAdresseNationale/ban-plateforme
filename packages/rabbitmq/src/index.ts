export {
  RABBITMQ_VHOST,
  connectionConfig,
  getRabbitMqConnectionConfig,
  type RabbitMqConnectionConfig,
} from './config.js';

export {
  LEGACY_RABBITMQ_EXCHANGES,
  RABBITMQ_EXCHANGES,
  exchangesConfig,
  legacyRabbitExchanges,
  rabbitExchanges,
  type LegacyRabbitMqExchangeName,
  type RabbitMqExchangeName,
} from './exchanges.js';

export {
  LEGACY_RABBITMQ_QUEUES,
  RABBITMQ_QUEUES,
  legacyRabbitQueues,
  rabbitQueues,
  type LegacyRabbitMqQueueName,
  type RabbitMqQueueName,
} from './queues.js';

export {
  RABBITMQ_ROUTING_KEYS,
  routingKeys,
  type RabbitMqRoutingKey,
} from './routing-keys.js';

export {
  deadLetterQueueOptions,
  publishOptions,
  queueOptions,
  recoveryStrategies,
  retryPolicy,
  retryQueueOptions,
  subscriptionDefaults,
} from './policies.js';

export {
  FatalMessageError,
  RetryableMessageError,
} from './errors.js';

export {
  rabbitTopology,
} from './topology.js';

export type {
  RabbitMqBindingConfig,
  RabbitMqBrokerConfig,
  RabbitMqPublicationConfig,
  RabbitMqQueueConfig,
  RabbitMqServiceName,
  RabbitMqSubscriptionConfig,
} from './types.js';
