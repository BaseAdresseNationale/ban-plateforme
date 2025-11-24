import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import { getBalVersion } from './index.js';

const pathToMockBalJSON1 = './data-mock/adresses-21286_cocorico.json';
const mockBalJSONstr1 = fs.readFileSync(pathToMockBalJSON1, 'utf8');
const balJSON1 = JSON.parse(mockBalJSONstr1);

const pathToMockBalJSON2 = './data-mock/adresses-21286_cocorico.1.4.json';
const mockBalJSONstr2 = fs.readFileSync(pathToMockBalJSON2, 'utf8');
const balJSON2 = JSON.parse(mockBalJSONstr2);

describe('balTopoToBanTopo', () => {
  test('Should return version 1.3', async () => {
    expect(getBalVersion(balJSON1)).toMatchSnapshot();
  });

  test('Should return version 1.4', async () => {
    expect(getBalVersion(balJSON2)).toMatchSnapshot();
  });
});
