import { Injectable } from '@nestjs/common';

@Injectable()
export class StringService {
  concatenate(data: string[]): string {
    return data.join(' ');
  }

  capitalize(data: string): string {
    return data.toUpperCase();
  }
}
