import type { BalAdresse } from '@ban/types';

import fs from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import balJSONlegacy2balJSON from './bal-json-legacy-to-bal-json.js';

vi.mock('uuid', () => {
  function* uuidGenerator() {
    let i = 0;
    while (true) yield `mocked-uuid-${i++}`;
  }
  const gen = uuidGenerator();
  return { v4: () => gen.next().value };
});

const pathToMockBalJSONlegacy =
  './data-mock/adresses-21286_cocorico.legacy.json';
const mockBalJSONlegacyStr = fs.readFileSync(pathToMockBalJSONlegacy, 'utf8');
const balJSONlegacy = JSON.parse(mockBalJSONlegacyStr).map(
  (balAddress: BalAdresse) => ({
    ...balAddress,
    date_der_maj: new Date(balAddress.date_der_maj),
  })
);

const pathToMockBalJSONpartial =
  './data-mock/adresses-21286_cocorico.partial.json';
const mockBalJSONpartialStr = fs.readFileSync(pathToMockBalJSONpartial, 'utf8');
const balJSONpartial = JSON.parse(mockBalJSONpartialStr).map(
  (balAddress: BalAdresse) => ({
    ...balAddress,
    date_der_maj: new Date(balAddress.date_der_maj),
  })
);

const pathToMockBalJSON = './data-mock/adresses-21286_cocorico.json';
const mockBalJSONstr = fs.readFileSync(pathToMockBalJSON, 'utf8');
const balJSON = JSON.parse(mockBalJSONstr).map((balAddress: BalAdresse) => ({
  ...balAddress,
  date_der_maj: new Date(balAddress.date_der_maj),
}));

describe('balJSONlegacy2balJSON', () => {
  test('should convert BAL JSON legacy into BAL JSON with BanIDs', async () => {
    const balJSONupdated = balJSONlegacy2balJSON(balJSONlegacy);
    expect(balJSONupdated).toMatchSnapshot();
  });

  test('should convert partial BAL JSON legacy into BAL JSON with BanIDs', async () => {
    const balJSONupdated = balJSONlegacy2balJSON(balJSONpartial);
    expect(balJSONupdated).toMatchSnapshot();
  });

  test('should no update BAL JSON with BanIDs', async () => {
    const balJSONnoUpdated = balJSONlegacy2balJSON(balJSON);
    expect(balJSONnoUpdated).toEqual(balJSON);
  });
});
