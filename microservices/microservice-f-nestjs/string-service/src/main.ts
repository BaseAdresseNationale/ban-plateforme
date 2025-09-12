import { NestFactory } from '@nestjs/core';
import { StringModule } from './string.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    StringModule,
    {
      transport: Transport.TCP,
      options: {
        host: 'string-service',
        port: 9001,
      },
    },
  );
  await app.listen();
  console.log('String microservice is listening on port 9001');
}
void bootstrap();
