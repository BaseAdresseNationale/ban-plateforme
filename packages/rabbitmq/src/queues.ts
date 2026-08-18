export const rabbitQueues = {
  service: (serviceName: string) => `ban.${serviceName}`,
  retry: (serviceName: string) => `ban.${serviceName}.retry`,
  deadLetter: (serviceName: string) => `ban.${serviceName}.dead-letter`,
} as const;

export const RABBITMQ_QUEUES = rabbitQueues;

export type RabbitMqQueueName = `ban.${string}`;
