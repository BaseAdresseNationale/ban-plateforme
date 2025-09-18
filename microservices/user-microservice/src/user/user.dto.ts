import { IsNotEmpty } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  email: string;
}

export class ForgotPasswordDto {
  @IsNotEmpty()
  email: string;
}
