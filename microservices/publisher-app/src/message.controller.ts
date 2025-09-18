import { Controller, Post, Body, Header } from '@nestjs/common';
import { MessageService } from './message.service';

@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  @Header('Content-Type', 'application/json')
  async sendMessage(@Body() body: { message: string }): Promise<void> {
    console.log('send messages controller');
    const { message } = body;
    await this.messageService.sendMessage(message);
  }
}
