import { Injectable } from '@nestjs/common';

@Injectable()
export class MathService {
  calculateSum(data: number[]): number {
    return data.reduce((a, b) => a + b, 0);
  }

  calculateProduct(data: number[]): number {
    return data.reduce((a, b) => a * b, 1);
  }
}
