import { Test, TestingModule } from '@nestjs/testing';
import { MathController } from './math.controller';
import { MathService } from './math.service';

describe('MathController', () => {
  let mathController: MathController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [MathController],
      providers: [MathService],
    }).compile();

    mathController = app.get<MathController>(MathController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(mathController.calculateSum([1, 2])).toBe(3);
    });
  });
});
