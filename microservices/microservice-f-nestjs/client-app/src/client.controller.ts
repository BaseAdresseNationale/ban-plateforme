import { Controller, Get } from '@nestjs/common';
import { ClientService } from './client.service';

@Controller()
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Get('sum')
  async getSum(): Promise<string | undefined> {
    return await this.clientService.calculateSum([1, 2, 3, 4, 5]);
  }

  @Get('capitalize')
  async getCapitalized(): Promise<string | undefined> {
    return await this.clientService.capitalizeString('hello world');
  }
}
