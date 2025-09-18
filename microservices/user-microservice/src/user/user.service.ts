import { ClientProxy } from '@nestjs/microservices';
import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CreateUserDto, ForgotPasswordDto } from './user.dto';

@Injectable()
export class UserService {
  constructor(
    @Inject('EMAIL_SERVICE') private readonly emailService: ClientProxy,
  ) {
    void this.emailService.connect();
  }

  async createUser(email: string) {
    // Simulate user creation logic
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const id = uuidv4();
    return { id, email };
  }

  async resetPassword(email: string) {
    // Simulate user creation logic
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const id = uuidv4();
    return { id, email };
  }

  public async signup(data: CreateUserDto) {
    const user = await this.createUser(data.email);
    this.emailService.emit('user_created', { email: user.email });
    return user;
  }

  public async sendForgotPasswordMessage(
    data: ForgotPasswordDto,
  ): Promise<void> {
    this.emailService.emit('user_forgot_password', { email: data.email });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return;
  }
}
