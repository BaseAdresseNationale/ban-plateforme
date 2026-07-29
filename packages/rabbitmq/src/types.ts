import type {
  BindingConfig,
  BrokerConfig,
  PublicationConfig,
  QueueConfig,
  SubscriptionConfig,
} from 'rascal';

export type {
  BindingConfig as RabbitMqBindingConfig,
  BrokerConfig as RabbitMqBrokerConfig,
  PublicationConfig as RabbitMqPublicationConfig,
  QueueConfig as RabbitMqQueueConfig,
  SubscriptionConfig as RabbitMqSubscriptionConfig,
};

export type RabbitMqServiceName =
  | 'ban-core-api'
  | 'bal-parser'
  | 'orchestrator'
  | 'beautifier'
  | 'target-key'
  | 'old-district'
  | 'merger'
  | 'ban-core-writer'
  | (string & {});
