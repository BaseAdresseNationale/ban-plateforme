import { IsNotEmpty } from 'class-validator';

export class HandleCreateUserDto {
  @IsNotEmpty()
  email: string;
}

export class HandleForgotPasswordUserDto {
  @IsNotEmpty()
  email: string;
}
