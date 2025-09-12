import { Controller } from '@nestjs/common';
import { StringService } from './string.service';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class StringController {
  constructor(private readonly stringService: StringService) {}

  @MessagePattern({ cmd: 'concat' })
  concatenate(data: string[]): string {
    return this.stringService.concatenate(data);
  }

  @MessagePattern({ cmd: 'capitalize' })
  capitalize(data: string): string {
    return this.stringService.capitalize(data);
  }
}
