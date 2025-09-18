import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MessageSubscriberService } from './message.subscriber.service';
import { MessageSubscriberController } from './message.subscriber.controller';

@Module({
  imports: [],
  controllers: [AppController, MessageSubscriberController],
  providers: [AppService, MessageSubscriberService],
})
export class AppModule {}
