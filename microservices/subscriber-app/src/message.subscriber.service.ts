import { Injectable } from '@nestjs/common';

@Injectable()
export class MessageSubscriberService {
  async handleSendMessage(data: { message: string }) {
    console.log(`Received message service: ${data.message}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { status: 'Message processed' };
  }
}
