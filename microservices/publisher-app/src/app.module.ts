import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { MessageModule } from './message.module';
import { MessageController } from './message.controller';
import { AppService } from './app.service';

@Module({
  imports: [MessageModule],
  controllers: [AppController, MessageController],
  providers: [AppService],
})
export class AppModule {}
