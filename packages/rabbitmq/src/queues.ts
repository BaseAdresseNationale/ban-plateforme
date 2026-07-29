export const rabbitQueues = {
  service: (serviceName: string) => `ban.${serviceName}`,
  retry: (serviceName: string) => `ban.${serviceName}.retry`,
  deadLetter: (serviceName: string) => `ban.${serviceName}.dead-letter`,
} as const;

export const legacyRabbitQueues = {
  serviceInput: (serviceName: string) => `${serviceName}.in`,
} as const;

export const RABBITMQ_QUEUES = rabbitQueues;
export const LEGACY_RABBITMQ_QUEUES = legacyRabbitQueues;

export type RabbitMqQueueName = `ban.${string}`;
export type LegacyRabbitMqQueueName = `${string}.in`;
