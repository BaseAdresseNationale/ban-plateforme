import type { BrokerAsPromised } from 'rascal';

type RabbitMqBroker = Awaited<ReturnType<typeof BrokerAsPromised.create>>;

let broker: RabbitMqBroker | null = null;

export const setRabbitMqBroker = (rabbitMqBroker: RabbitMqBroker) => {
  broker = rabbitMqBroker;
};

export const publishRabbitMqMessage = async (publication: string, message: unknown) => {
  if (!broker) {
    throw new Error('RabbitMQ broker is not initialized');
  }

  await broker.publish(publication, message);
};
