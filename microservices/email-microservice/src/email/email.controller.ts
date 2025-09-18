import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { HandleCreateUserDto, HandleForgotPasswordUserDto } from './email.dto';
import { EmailService } from './email.service';

@Controller()
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @EventPattern('user_created')
  async handleUserCreated(@Payload() data: HandleCreateUserDto) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const { email } = data;
      this.emailService.handleUserCreated(email);
    } catch (error) {
      console.error('Error handling user_created event:', error);
    }
  }

  @EventPattern('user_forgot_password')
  handleForgotPasswordUser(@Payload() data: HandleForgotPasswordUserDto) {
    const { email } = data;
    this.emailService.handleForgotPasswordUser(email);
  }
}
