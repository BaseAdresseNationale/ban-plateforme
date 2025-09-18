import { Controller, Body, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, ForgotPasswordDto } from './user.dto';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('/signup')
  async signup(@Body() body: CreateUserDto) {
    return this.userService.signup(body);
  }

  @Post('/forgot-password')
  forgotPassword(@Body() data: ForgotPasswordDto): Promise<void> {
    return this.userService.sendForgotPasswordMessage(data);
  }

  // @EventPattern('user_created')
  // async handleUserCreated(data: Record<string, unknown>) {
  //   await this.userService.createUser(data.name as string);
  // }
}
