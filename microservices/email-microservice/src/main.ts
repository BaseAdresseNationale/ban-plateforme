import { NestFactory } from '@nestjs/core';
import { EmailModule } from './email/email.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  // const app = await NestFactory.createMicroservice<MicroserviceOptions>(
  //   EmailModule,
  //   {
  //     transport: Transport.RMQ,
  //     options: {
  //       urls: ['amqp://rabbitmq:5672'],
  //       queue: 'user_queue',
  //       queueOptions: {
  //         durable: false,
  //       },
  //     },
  //   },
  // );

  // await app.listen();

  const app = await NestFactory.create(EmailModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://rabbitmq:5672'],
      queue: 'user_queue',
      queueOptions: {
        durable: false,
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 13000);
}
void bootstrap();
