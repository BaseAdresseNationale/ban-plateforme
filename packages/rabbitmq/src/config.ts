import type { ConnectionConfig } from 'rascal';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RABBITMQ_VHOST = '/' as const;

export type RabbitMqConnectionConfig = ConnectionConfig;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

const localRabbitMqDefaults = {
  RABBITMQ_HOST: 'localhost',
  RABBITMQ_PORT: '5672',
  RABBITMQ_USER: 'guest',
  RABBITMQ_PASSWORD: 'guest',
} as const;

const getRabbitMqEnv = (name: keyof typeof localRabbitMqDefaults) => {
  const value = process.env[name];

  if (value) {
    return value;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable ${name}`);
  }

  return localRabbitMqDefaults[name];
};

const rabbitMqPort = Number(getRabbitMqEnv('RABBITMQ_PORT'));

if (!Number.isInteger(rabbitMqPort) || rabbitMqPort <= 0) {
  throw new Error('RABBITMQ_PORT must be a positive integer');
}

export const connectionConfig: RabbitMqConnectionConfig = {
  protocol: 'amqp',
  hostname: getRabbitMqEnv('RABBITMQ_HOST'),
  port: rabbitMqPort,
  user: getRabbitMqEnv('RABBITMQ_USER'),
  password: getRabbitMqEnv('RABBITMQ_PASSWORD'),
};

export const getRabbitMqConnectionConfig = (): RabbitMqConnectionConfig => ({
  ...connectionConfig,
});
