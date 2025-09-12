import { Test, TestingModule } from '@nestjs/testing';
import { ClientController } from './client.controller';
import { ClientService } from './client.service';

describe('ClientController', () => {
  let clientController: ClientController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ClientController],
      providers: [ClientService],
    }).compile();

    clientController = app.get<ClientController>(ClientController);
  });

  describe('root', () => {
    it('should return "15"', () => {
      expect(clientController.getSum()).toBe('15');
    });
  });
});
