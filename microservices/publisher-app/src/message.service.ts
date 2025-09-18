import { Injectable } from '@nestjs/common';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';

@Injectable()
export class MessageService {
  private client = ClientProxyFactory.create({
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://rabbitmq:5672'],
      queue: 'messages_queue',
      exchange: 'messages_exchange',
      queueOptions: { durable: true },
      noAck: true,
    },
  });

  async sendMessage(message: string): Promise<void> {
    console.log('send messages service');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    this.client.emit('send_message', { message }).subscribe();
  }
}
