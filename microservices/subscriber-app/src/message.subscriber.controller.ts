import { Controller } from '@nestjs/common';
import { MessageSubscriberService } from './message.subscriber.service';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller()
export class MessageSubscriberController {
  constructor(
    private readonly messageSubscriberService: MessageSubscriberService,
  ) {}

  @EventPattern('send_message')
  handleSendMessage(@Payload() data: { message: string }) {
    console.log(`Received message controller: ${data.message}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return this.messageSubscriberService.handleSendMessage(data);
  }
}
