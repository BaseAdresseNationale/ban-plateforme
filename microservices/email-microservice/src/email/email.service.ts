import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailService {
  handleUserCreated(email: string) {
    console.log('New user created, sending email to:', email);
    // Here you can call an actual email service to send emails
  }

  handleForgotPasswordUser(email: string) {
    console.log('Reset password link sent to:', email);
    // Here you can call an actual email service to send emails
  }
}
