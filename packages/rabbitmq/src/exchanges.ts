import type { ExchangeConfig } from 'rascal';

export const rabbitExchanges = {
  commands: 'ban.commands',
  pipeline: 'ban.pipeline',
  events: 'ban.events',
  retry: 'ban.retry',
  deadLetter: 'ban.dead-letter',
} as const;

export const legacyRabbitExchanges = {
  balEvents: 'bal.events',
} as const;

export const exchangesConfig = {
  commands: {
    name: rabbitExchanges.commands,
    type: 'topic',
    assert: true,
    options: { durable: true },
  },
  pipeline: {
    name: rabbitExchanges.pipeline,
    type: 'topic',
    assert: true,
    options: { durable: true },
  },
  events: {
    name: rabbitExchanges.events,
    type: 'topic',
    assert: true,
    options: { durable: true },
  },
  retry: {
    name: rabbitExchanges.retry,
    type: 'topic',
    assert: true,
    options: { durable: true },
  },
  deadLetter: {
    name: rabbitExchanges.deadLetter,
    type: 'topic',
    assert: true,
    options: { durable: true },
  },
} as const satisfies Record<string, ExchangeConfig>;

export const RABBITMQ_EXCHANGES = rabbitExchanges;
export const LEGACY_RABBITMQ_EXCHANGES = legacyRabbitExchanges;

export type RabbitMqExchangeName =
  typeof rabbitExchanges[keyof typeof rabbitExchanges];

export type LegacyRabbitMqExchangeName =
  typeof legacyRabbitExchanges[keyof typeof legacyRabbitExchanges];
