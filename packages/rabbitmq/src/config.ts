import type { ConnectionConfig } from 'rascal';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RABBITMQ_VHOST = '/' as const;

export type RabbitMqConnectionConfig = ConnectionConfig;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

const getEnv = (name: string, fallback: string) => process.env[name] ?? fallback;

export const connectionConfig: RabbitMqConnectionConfig = {
  protocol: 'amqp',
  hostname: getEnv('RABBITMQ_HOST', 'localhost'),
  port: Number(getEnv('RABBITMQ_PORT', '5672')),
  user: getEnv('RABBITMQ_USER', 'guest'),
  password: getEnv('RABBITMQ_PASSWORD', 'guest'),
};

export const getRabbitMqConnectionConfig = (): RabbitMqConnectionConfig => ({
  ...connectionConfig,
});
