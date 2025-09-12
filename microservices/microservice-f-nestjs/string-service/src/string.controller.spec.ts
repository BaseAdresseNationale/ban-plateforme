import { Test, TestingModule } from '@nestjs/testing';
import { StringController } from './string.controller';
import { StringService } from './string.service';

describe('StringController', () => {
  let stringController: StringController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [StringController],
      providers: [StringService],
    }).compile();

    stringController = app.get<StringController>(StringController);
  });

  describe('root', () => {
    it('should return "ABC"', () => {
      expect(stringController.capitalize('abc')).toBe('ABC');
    });
  });
});
