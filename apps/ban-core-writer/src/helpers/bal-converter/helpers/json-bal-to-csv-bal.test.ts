import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import jsonBalToCsvBal from './json-bal-to-csv-bal.js';

const pathToMockBalJSON = './data-mock/adresses-21286_cocorico.legacy.json';
const rawMockBalJSON = fs.readFileSync(pathToMockBalJSON, 'utf8');
const mockBalJSON = JSON.parse(rawMockBalJSON);

describe('csvBalToJsonBal', () => {
  test('should convert BAL CSV list into BAL JSON list', async () => {
    const balCSV = jsonBalToCsvBal(mockBalJSON);
    expect(balCSV).toMatchSnapshot();
  });
});
