import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: ['amqp://rabbitmq:5672'],
        queue: 'messages_queue',
        exchange: 'messages_exchange',
        queueOptions: { durable: true },
        noAck: true,
      },
    },
  );

  await app.listen();
}
void bootstrap();
