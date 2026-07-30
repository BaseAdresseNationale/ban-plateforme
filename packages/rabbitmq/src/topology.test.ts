import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  FatalMessageError,
  RABBITMQ_EXCHANGES,
  RABBITMQ_QUEUES,
  RABBITMQ_ROUTING_KEYS,
  RABBITMQ_VHOST,
  RetryableMessageError,
  connectionConfig,
  deadLetterQueueOptions,
  exchangesConfig,
  getRabbitMqConnectionConfig,
  publishOptions,
  queueOptions,
  rabbitExchanges,
  rabbitQueues,
  recoveryStrategies,
  retryPolicy,
  retryQueueOptions,
  routingKeys,
  subscriptionDefaults,
} from './index.js';

const originalEnv = { ...process.env };

afterEach(() => {
  vi.resetModules();

  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, originalEnv);
});

describe('shared RabbitMQ topology', () => {
  it('declares the shared exchange names', () => {
    expect(rabbitExchanges).toEqual({
      commands: 'ban.commands',
      pipeline: 'ban.pipeline',
      events: 'ban.events',
      retry: 'ban.retry',
      deadLetter: 'ban.dead-letter',
    });
    expect(RABBITMQ_EXCHANGES).toBe(rabbitExchanges);
  });

  it('declares durable topic exchanges for every shared exchange', () => {
    expect(exchangesConfig).toEqual({
      commands: {
        name: 'ban.commands',
        type: 'topic',
        assert: true,
        options: { durable: true },
      },
      pipeline: {
        name: 'ban.pipeline',
        type: 'topic',
        assert: true,
        options: { durable: true },
      },
      events: {
        name: 'ban.events',
        type: 'topic',
        assert: true,
        options: { durable: true },
      },
      retry: {
        name: 'ban.retry',
        type: 'topic',
        assert: true,
        options: { durable: true },
      },
      deadLetter: {
        name: 'ban.dead-letter',
        type: 'topic',
        assert: true,
        options: { durable: true },
      },
    });
  });

  it('keeps queue naming conventions stable', () => {
    expect(rabbitQueues.service('beautifier')).toBe('ban.beautifier');
    expect(rabbitQueues.retry('beautifier')).toBe('ban.beautifier.retry');
    expect(rabbitQueues.deadLetter('beautifier')).toBe('ban.beautifier.dead-letter');
    expect(RABBITMQ_QUEUES).toBe(rabbitQueues);
  });

  it('declares shared routing keys', () => {
    expect(routingKeys).toEqual({
      balUploaded: 'bal.uploaded',
      balParsed: 'bal.parsed',
      balEnrich: 'bal.enrich',
      balBeautified: 'bal.enriched.beautifier',
      balEnrichedTargetKey: 'bal.enriched.target-key',
      balEnrichedOldDistrict: 'bal.enriched.old-district',
      balEnrichedAll: 'bal.enriched.*',
      balReady: 'bal.ready',
      exportRequested: 'export.requested',
      exportCompleted: 'export.completed',
      exportFailed: 'export.failed',
      retryAll: '#',
      deadLetterAll: '#',
    });
    expect(RABBITMQ_ROUTING_KEYS).toBe(routingKeys);
  });

  it('declares shared connection and vhost configuration', () => {
    expect(RABBITMQ_VHOST).toBe('/');
    expect(connectionConfig.protocol).toBe('amqp');
    expect(connectionConfig.hostname).toEqual(expect.any(String));
    expect(connectionConfig.port).toEqual(expect.any(Number));
    expect(connectionConfig.user).toEqual(expect.any(String));
    expect(connectionConfig.password).toEqual(expect.any(String));
  });

  it('returns a defensive copy of the connection configuration', () => {
    const copiedConnectionConfig = getRabbitMqConnectionConfig();

    expect(copiedConnectionConfig).toEqual(connectionConfig);
    expect(copiedConnectionConfig).not.toBe(connectionConfig);
  });

  it('keeps RabbitMQ defaults limited to non-production environments', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.RABBITMQ_HOST = '';
    process.env.RABBITMQ_PORT = '';
    process.env.RABBITMQ_USER = '';
    process.env.RABBITMQ_PASSWORD = '';

    const config = await import('./config.js');

    expect(config.connectionConfig).toMatchObject({
      hostname: 'localhost',
      port: 5672,
      user: 'guest',
      password: 'guest',
    });
  });

  it('requires explicit RabbitMQ configuration in production', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.RABBITMQ_HOST = '';
    process.env.RABBITMQ_PORT = '5672';
    process.env.RABBITMQ_USER = 'guest';
    process.env.RABBITMQ_PASSWORD = 'guest';

    await expect(import('./config.js')).rejects.toThrow('Missing required environment variable RABBITMQ_HOST');
  });

  it('declares shared durability, publication, retry and recovery defaults', () => {
    expect(queueOptions).toEqual({ durable: true });
    expect(retryQueueOptions).toEqual({
      durable: true,
      messageTtl: 30_000,
      deadLetterExchange: rabbitExchanges.pipeline,
    });
    expect(deadLetterQueueOptions).toEqual({ durable: true });
    expect(publishOptions).toEqual({ persistent: true });
    expect(subscriptionDefaults).toEqual({ prefetch: 1 });
    expect(retryPolicy).toEqual({
      attempts: 3,
      delayMs: 30_000,
      exchange: rabbitExchanges.retry,
    });
    expect(recoveryStrategies).toEqual({
      acknowledge: {
        strategy: 'ack',
      },
      rejectAndDeadLetter: {
        strategy: 'nack',
        requeue: false,
      },
    });
  });
});

describe('message classification errors', () => {
  it('exposes retryable message errors as standard errors', () => {
    const cause = new Error('network timeout');
    const error = new RetryableMessageError('temporary failure', { cause });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(RetryableMessageError);
    expect(error.name).toBe('RetryableMessageError');
    expect(error.message).toBe('temporary failure');
    expect(error.cause).toBe(cause);
  });

  it('exposes fatal message errors as standard errors', () => {
    const cause = new Error('invalid payload');
    const error = new FatalMessageError('fatal failure', { cause });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(FatalMessageError);
    expect(error.name).toBe('FatalMessageError');
    expect(error.message).toBe('fatal failure');
    expect(error.cause).toBe(cause);
  });
});
