import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import csvBalToJsonBal from './csv-bal-to-json-bal.js';

const pathToMockBalCSV = './data-mock/adresses-21286_cocorico.csv';
const mockBalCSV = fs.readFileSync(pathToMockBalCSV, 'utf8');

describe('csvBalToJsonBal', () => {
  test('should convert BAL CSV list into BAL JSON list', async () => {
    const balJSON = csvBalToJsonBal(mockBalCSV);
    expect(balJSON).toMatchSnapshot();
  });
});
