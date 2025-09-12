import { NestFactory } from '@nestjs/core';
import { MathModule } from './math.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    MathModule,
    {
      transport: Transport.TCP,
      options: {
        host: 'math-service',
        port: 8001,
      },
    },
  );
  await app.listen();
  console.log('Math microservice is listening on port 8001');
}
void bootstrap();
