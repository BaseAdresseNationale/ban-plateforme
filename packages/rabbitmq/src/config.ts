import type { ConnectionConfig } from 'rascal';

import { env } from '@ban/config';

export const RABBITMQ_VHOST = '/' as const;

export type RabbitMqConnectionConfig = ConnectionConfig;

export const connectionConfig: RabbitMqConnectionConfig = {
  protocol: 'amqp',
  hostname: env.RABBIT.host,
  port: Number(env.RABBIT.port),
  user: env.RABBIT.user,
  password: env.RABBIT.password,
};

export const getRabbitMqConnectionConfig = (): RabbitMqConnectionConfig => ({
  ...connectionConfig,
});
