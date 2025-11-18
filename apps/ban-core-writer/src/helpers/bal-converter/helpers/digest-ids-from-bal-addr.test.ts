import type { BalAdresse } from '@ban/types';

import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import digestIDsFromBalAddr from './digest-ids-from-bal-addr.js';

const pathToMockBalJSON = './data-mock/adresses-21286_cocorico.json';
const mockBalJSONstr = fs.readFileSync(pathToMockBalJSON, 'utf8');
const balJSON = JSON.parse(mockBalJSONstr).map((balAddress: BalAdresse) => ({
  ...balAddress,
  date_der_maj: new Date(balAddress.date_der_maj),
}));

describe('balJSONlegacy2balJSON', () => {
  test('should convert BAL JSON legacy into BAL JSON with BanIDs', async () => {
    const banIDs = balJSON.map((balAddress: BalAdresse) =>
      digestIDsFromBalAddr(balAddress)
    );
    expect(banIDs).toMatchSnapshot();
  });
});
