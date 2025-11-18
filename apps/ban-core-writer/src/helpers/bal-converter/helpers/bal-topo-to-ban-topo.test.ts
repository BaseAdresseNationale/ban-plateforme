import type { BalAdresse } from '@ban/types';
import type { BanCommonToponym } from '@ban/types';

import { describe, expect, test } from 'vitest';
import {
  idSampleWithAddressId,
  idSampleWithMainTopoId,
  idSampleWithAddressIdAndMainTopoId,
  idSampleWithAllIds,
} from './__mocks__/fake-data.js';
import balTopoToBanTopo from './bal-topo-to-ban-topo.js';

const defaultTestBalAddress: BalAdresse = {
  cle_interop: '21286_0001_00001',
  commune_insee: '21286',
  commune_nom: 'Cocorico',
  voie_nom: 'Route de la Baleine',
  numero: 1,
  position: 'autre',
  x: 1,
  y: 2,
  long: 1,
  lat: 2,
  date_der_maj: new Date('2021-01-01'),
  certification_commune: true,
  source: 'BAL',
};

describe('balTopoToBanTopo', () => {
  test('should return BanToponym without BanTopoID', async () => {
    expect(balTopoToBanTopo(defaultTestBalAddress)).toMatchSnapshot();
  });

  test('should return BanToponym without BanTopoID', async () => {
    const testBalAdresse: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithAddressId,
    };
    expect(balTopoToBanTopo(testBalAdresse)).toMatchSnapshot();
  });

  test('should return BanToponym with BanTopoID (1)', async () => {
    const testBalAdresse: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithMainTopoId,
    };
    expect(balTopoToBanTopo(testBalAdresse)).toMatchSnapshot();
  });

  test('should return BanToponym with BanTopoID (2)', async () => {
    const testBalAdresse: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithAddressIdAndMainTopoId,
    };
    expect(balTopoToBanTopo(testBalAdresse)).toMatchSnapshot();
  });

  test('should return BanToponym with BanTopoID and BanDistrictID', async () => {
    const testBalAdresse: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithAllIds,
    };
    expect(balTopoToBanTopo(testBalAdresse)).toMatchSnapshot();
  });

  test('should return BanToponym with multilingual label', async () => {
    const testBalAdresse: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithMainTopoId,
      voie_nom: 'Route de la Baleine',
      voie_nom_eus: 'Baleen ibilbidea',
    };
    expect(balTopoToBanTopo(testBalAdresse)).toMatchSnapshot();
  });

  test('should return BanToponym with multilingual label and overwrited default value', async () => {
    // TODO : In next version - should probably not return BanToponym with overwrited data and throw an error
    const testBalAdresse: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithMainTopoId,
      voie_nom: 'Baleen ibilbidea',
      voie_nom_fra: 'Route de la Baleine',
    };
    expect(balTopoToBanTopo(testBalAdresse)).toMatchSnapshot();
  });

  test('should return BanToponym with multilingual label and personal config for default lang', async () => {
    const testBalAdresse: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithMainTopoId,
      voie_nom: 'Baleen ibilbidea',
      voie_nom_fra: 'Route de la Baleine',
    };
    expect(balTopoToBanTopo(testBalAdresse, undefined, undefined, { defaultBalLang: 'eus' })).toMatchSnapshot();
  });

  test('should return BanToponym with multilingual label, personal config for default lang  and overwrited default value', async () => {
    // TODO : In next version - should probably not return BanToponym with overwrited data and throw an error
    const testBalAdresse: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithMainTopoId,
      voie_nom: 'Baleen ibilbidea',
      voie_nom_fra: 'Route de la baleine sacrée',
      voie_nom_eus: 'Balea Sakratuaren Ibilbidea',
    };
    expect(balTopoToBanTopo(testBalAdresse, undefined, undefined, { defaultBalLang: 'eus' })).toMatchSnapshot();
  });

  test('should return BanToponym with multilingual label and ignore empty default value', async () => {
    const testBalAdresse: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithMainTopoId,
      voie_nom: 'Baleen ibilbidea',
      voie_nom_fra: '',
    };
    expect(balTopoToBanTopo(testBalAdresse)).toMatchSnapshot();
  });

  test('should return BanToponym with multilingual label after cleaning non-compliant ISO code lang', async () => {
    const testBalAdresse: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithMainTopoId,
      voie_nom: 'Baleen ibilbidea',
      voie_nom_unknowISO: 'Anything',
    };
    expect(balTopoToBanTopo(testBalAdresse)).toMatchSnapshot();
  });

  test('should return BanToponym with overwrited data', async () => {
    // TODO : In next version - should probably not return BanToponym with overwrited data and throw an error ?
    const testOldBalAdresse: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithAllIds,
      voie_nom: 'Route de la Baleine',
    };
    const oldBanToponym = balTopoToBanTopo(
      testOldBalAdresse
    ) as BanCommonToponym;

    const testBalAdresse: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithAllIds,
      voie_nom: 'Avenue Rhoam Bosphoramus',
    };
    expect(balTopoToBanTopo(testBalAdresse, oldBanToponym)).toMatchSnapshot();
  });
});
