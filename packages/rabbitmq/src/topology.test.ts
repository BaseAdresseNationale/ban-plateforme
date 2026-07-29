import { describe, expect, it } from 'vitest';

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
