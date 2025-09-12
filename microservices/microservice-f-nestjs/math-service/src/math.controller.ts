import { Controller } from '@nestjs/common';
import { MathService } from './math.service';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class MathController {
  constructor(private readonly mathService: MathService) {}

  @MessagePattern({ cmd: 'sum' })
  calculateSum(data: number[]): number {
    return this.mathService.calculateSum(data);
  }

  @MessagePattern({ cmd: 'multiply' })
  calculateProduct(data: number[]): number {
    return this.mathService.calculateProduct(data);
  }
}
