import { Injectable } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';

@Injectable()
export class ClientService {
  private mathClient: ClientProxy;
  private stringClient: ClientProxy;

  constructor() {
    this.mathClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: 'math-service', port: 8001 },
    });
    this.stringClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: 'string-service', port: 9001 },
    });
  }

  async calculateSum(numbers: number[]): Promise<string | undefined> {
    return this.mathClient
      .send<string, number[]>({ cmd: 'sum' }, numbers)
      .toPromise();
  }

  async capitalizeString(data: string): Promise<string | undefined> {
    return this.stringClient
      .send<string, string>({ cmd: 'capitalize' }, data)
      .toPromise();
  }
}
