import { Module } from '@nestjs/common';
import { MathController } from './math.controller';
import { MathService } from './math.service';

@Module({
  controllers: [MathController],
  providers: [MathService],
})
export class MathModule {}
