import type { PublicationConfig, QueueConfig, Recovery } from 'rascal';

import { rabbitExchanges } from './exchanges.js';

export const queueOptions = {
  durable: true,
} as const satisfies NonNullable<QueueConfig['options']>;

export const retryQueueOptions = {
  durable: true,
  messageTtl: 30_000,
  deadLetterExchange: rabbitExchanges.pipeline,
} as const satisfies NonNullable<QueueConfig['options']>;

export const deadLetterQueueOptions = {
  durable: true,
} as const satisfies NonNullable<QueueConfig['options']>;

export const publishOptions = {
  persistent: true,
} as const satisfies NonNullable<PublicationConfig['options']>;

export const subscriptionDefaults = {
  prefetch: 1,
} as const;

export const retryPolicy = {
  attempts: 3,
  delayMs: 30_000,
  exchange: rabbitExchanges.retry,
} as const;

export const recoveryStrategies = {
  acknowledge: {
    strategy: 'ack',
  },
  rejectAndDeadLetter: {
    strategy: 'nack',
    requeue: false,
  },
} as const satisfies Record<string, Recovery>;
