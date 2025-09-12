import { Module } from '@nestjs/common';
import { StringController } from './string.controller';
import { StringService } from './string.service';

@Module({
  controllers: [StringController],
  providers: [StringService],
})
export class StringModule {}
