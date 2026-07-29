export {
  RABBITMQ_VHOST,
  connectionConfig,
  getRabbitMqConnectionConfig,
  type RabbitMqConnectionConfig,
} from './config.js';

export {
  RABBITMQ_EXCHANGES,
  exchangesConfig,
  rabbitExchanges,
  type RabbitMqExchangeName,
} from './exchanges.js';

export {
  RABBITMQ_QUEUES,
  rabbitQueues,
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

export type {
  RabbitMqBindingConfig,
  RabbitMqBrokerConfig,
  RabbitMqPublicationConfig,
  RabbitMqQueueConfig,
  RabbitMqServiceName,
  RabbitMqSubscriptionConfig,
} from './types.js';
