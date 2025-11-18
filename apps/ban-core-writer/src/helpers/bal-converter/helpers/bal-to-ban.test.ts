import type { Bal } from '@ban/types';

import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import balToBan from './bal-to-ban.js';

const pathToMockBalJSON = './data-mock/adresses-21286_cocorico.json';
const mockBalJSONstr = fs.readFileSync(pathToMockBalJSON, 'utf8');
const mockBalJSON: Bal = JSON.parse(mockBalJSONstr);

describe('balToBan', () => {
  test('should convert Bal list into Ban list', async () => {
    const banJSON = balToBan(mockBalJSON);
    expect(banJSON).toMatchSnapshot();
  });
});
