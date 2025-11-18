import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import { validator } from './index.js';

const pathToMockBalJSONlegacy =
  './data-mock/adresses-21286_cocorico.legacy.json';
const mockBalJSONlegacyStr = fs.readFileSync(pathToMockBalJSONlegacy, 'utf8');
const balJSONlegacy = JSON.parse(mockBalJSONlegacyStr);

const districtID = 'e2b5c142-3eb3-4d07-830a-3d1a59195dfd';
const cog = '21286';

const pathToMockBalJSON_1 = './data-mock/adresses-21286_cocorico.json';
const mockBalJSONStr_1 = fs.readFileSync(pathToMockBalJSON_1, 'utf8');
const balJSON_1 = JSON.parse(mockBalJSONStr_1);

const pathToMockBalJSON_2 = './data-mock/adresses-21286_cocorico.1.4.json';
const mockBalJSONStr_2 = fs.readFileSync(pathToMockBalJSON_2, 'utf8');
const balJSON_2 = JSON.parse(mockBalJSONStr_2);

const banIDWhithoutDistrictID =
  '@v:787ca7cf-8072-47ae-a8c6-98a62a8dd90c @a:03fb190a-cf5b-4f48-a1ab-7caa4d10e157';
const balJSONSimplifiedAndModified_1 = [
  {
    ...balJSON_1[0],
  },
  {
    ...balJSON_1[1],
    uid_adresse: banIDWhithoutDistrictID,
  },
];

const banIDWhithoutCommonToponymID =
  '@c:e2b5c142-3eb3-4d07-830a-3d1a59195dfd @a:03fb190a-cf5b-4f48-a1ab-7caa4d10e157';
const balJSONSimplifiedAndModified_2 = [
  {
    ...balJSON_1[0],
  },
  {
    ...balJSON_1[1],
    uid_adresse: banIDWhithoutCommonToponymID,
  },
];

const banIDWhithoutAddressID =
  '@c:e2b5c142-3eb3-4d07-830a-3d1a59195dfd @v:787ca7cf-8072-47ae-a8c6-98a62a8dd90c';
const balJSONSimplifiedAndModified_3 = [
  {
    ...balJSON_1[0],
  },
  {
    ...balJSON_1[1],
    uid_adresse: banIDWhithoutAddressID,
  },
];

const balJSONSimplifiedAndModified_4 = [
  {
    ...balJSONlegacy[0],
  },
  {
    ...balJSON_1[1],
  },
];

const balWithDifferentDistrictID = [
  {
    ...balJSON_2[0],
    id_ban_commune: '1234',
  },
];

describe("balTopoToBanTopo", () => {
  test("Should return true as bal 1.3 uses ban IDs", async () => {
    expect(await validator([districtID], balJSON_1, '1.3', { cog })).toMatchSnapshot();
  });

  test("Should return true as bal 1.4 uses ban IDs", async () => {
    expect(await validator([districtID], balJSON_2, '1.4', { cog })).toMatchSnapshot();
  });

  test("Should return false as bal does not use ban IDs", async () => {
    expect(await validator([districtID], balJSONlegacy, '1.3', { cog })).toMatchSnapshot();
  });

  test('Should throw an error as bal does not have a district ID on one of its line', async () => {
    await expect(
      validator([districtID], balJSONSimplifiedAndModified_1, '1.3', { cog })
    ).rejects.toThrowError(/districtID manquant/);
  });

  test('Should throw an error as bal does not have a common toponym ID on one of its line', async () => {
    await expect(
      validator([districtID], balJSONSimplifiedAndModified_2, '1.3', { cog })
    ).rejects.toThrowError(/mainTopoID manquant/);
  });

  test('Should throw an error as bal does not have an address ID on one of its line that has a number different from the topo number', async () => {
    await expect(
      validator([districtID], balJSONSimplifiedAndModified_3, '1.3', { cog })
    ).rejects.toThrowError(/addressID manquant/);
  });

  test('Should throw an error as some lines are using BanIDs and some are not', async () => {
    await expect(
      validator([districtID], balJSONSimplifiedAndModified_4, '1.3', { cog })
    ).rejects.toThrowError(/IDs manquants/);
  });

  test("Should throw an error as district ID from BAL different from district ID from district DB", async () => {
    await expect(
      validator([districtID], balWithDifferentDistrictID, '1.4', { cog })
    ).rejects.toThrowError(/Droits manquants/);
  });
});
