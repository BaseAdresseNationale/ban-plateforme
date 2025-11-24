import type { BalAdresse } from '@ban/types';
import type { BanAddress } from '@ban/types';

import { describe, expect, test } from 'vitest';
import { numberForTopo as IS_TOPO_NB } from '../bal-converter.config.js';
import {
  idSampleWithAddressId,
  idSampleWithMainTopoId,
  idSampleWithAddressIdAndMainTopoId,
  idSampleWithAllIds,
} from './__mocks__/fake-data.js';
import balAddrToBanAddr from './bal-addr-to-ban-addr.js';

const defaultTestBalAddress: BalAdresse = {
  cle_interop: '21286_0001_00001',
  commune_insee: '21286',
  commune_nom: 'Cocorico',
  voie_nom: 'Route de la Baleine',
  numero: 1,
  position: 'entrée',
  x: 1,
  y: 2,
  long: 1,
  lat: 2,
  date_der_maj: new Date('2021-01-01'),
  certification_commune: true,
  source: 'BAL',
};

describe('balAddrToBanAddr', () => {
  test('should return BanAddress without BanID & BanTopoID', async () => {
    expect(balAddrToBanAddr(defaultTestBalAddress)).toMatchSnapshot();
  });

  test('should return BanAddress with BanID without BanTopoID', async () => {
    const testBalAddress: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithAddressId,
    };

    expect(balAddrToBanAddr(testBalAddress)).toMatchSnapshot();
  });

  test('should return BanAddress with BanTopoID', async () => {
    const testBalAddress: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithMainTopoId,
    };

    expect(balAddrToBanAddr(testBalAddress)).toMatchSnapshot();
  });

  test('should return BanAddress with BanID and BanTopoID', async () => {
    const testBalAddress: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithAddressIdAndMainTopoId,
    };

    expect(balAddrToBanAddr(testBalAddress)).toMatchSnapshot();
  });

  test('should return BanAddress with BanID, BanTopoID, other toponyms and BanDistrictID', async () => {
    const testBalAddress: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithAllIds,
    };

    expect(balAddrToBanAddr(testBalAddress)).toMatchSnapshot();
  });

  test('should not consider as Ban Address', async () => {
    const testBalAddress: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithMainTopoId,
      numero: Number(IS_TOPO_NB),
    };

    expect(balAddrToBanAddr(testBalAddress)).toMatchSnapshot();
  });

  test('should return BanAddress with multiple positions', async () => {
    const testOldBalAddress: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithAllIds,
      position: 'entrée',
      x: 1,
      y: 2,
      long: 1,
      lat: 2,
    };
    const oldBanAddress = balAddrToBanAddr(testOldBalAddress) as BanAddress;
    const testBalAddress: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithAllIds,
      position: 'autre',
      x: 3,
      y: 4,
      long: 3,
      lat: 4,
    };

    expect(balAddrToBanAddr(testBalAddress, oldBanAddress)).toMatchSnapshot();
  });

  test("should return BanAddress with number '0'", async () => {
    const testBalAddress: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithAllIds,
      numero: 0,
    };

    expect(balAddrToBanAddr(testBalAddress)).toMatchSnapshot();
  });

  test("should return BanAddress with label", async () => {
    const testBalAddress: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithAllIds,
      lieudit_complement_nom: 'Ancien chemin du hero',
    };

    expect(balAddrToBanAddr(testBalAddress)).toMatchSnapshot();
  });

  test("should return BanAddress with multilingual label", async () => {
    const testBalAddress: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithAllIds,
      lieudit_complement_nom: 'Ancien chemin du hero',
      lieudit_complement_nom_eus: 'Antzinako Heroiaren Bidea',
    };

    expect(balAddrToBanAddr(testBalAddress)).toMatchSnapshot();
  });

  test("should return BanAddress with multilingual label and overwrited default value", async () => {
    // TODO : In next version - should probably not return BanToponym with overwrited data and throw an error
    const testBalAddress: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithAllIds,
      lieudit_complement_nom: 'Antzinako Heroiaren Bidea',
      lieudit_complement_nom_fra: 'Ancien chemin du hero',
    };

    expect(balAddrToBanAddr(testBalAddress)).toMatchSnapshot();
  });

  test('should return BanToponym with multilingual label and personal config for default lang', async () => {
    const testBalAdresse: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithMainTopoId,
      lieudit_complement_nom: 'Antzinako Heroiaren Bidea',
      lieudit_complement_nom_fra: 'Ancien chemin du hero',
    };
    expect(balAddrToBanAddr(testBalAdresse, undefined, undefined, { defaultBalLang: 'eus' })).toMatchSnapshot();
  });

  test('should return BanToponym with multilingual label, personal config for default lang  and overwrited default value', async () => {
    // TODO : In next version - should probably not return BanToponym with overwrited data and throw an error
    const testBalAdresse: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithMainTopoId,
      lieudit_complement_nom: 'Antzinako Heroiaren Bidea',
      lieudit_complement_nom_fra: 'Ancien chemin du hero du temps',
      lieudit_complement_nom_eus: 'Denboraren heroiaren antzinako bidea',
    };
    expect(balAddrToBanAddr(testBalAdresse, undefined, undefined, { defaultBalLang: 'eus' })).toMatchSnapshot();
  });

  test("should return BanAddress with multilingual label and ignore empty default value", async () => {
    const testBalAddress: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithAllIds,
      lieudit_complement_nom: 'Ancien chemin du hero',
      lieudit_complement_nom_fra: '',
    };

    expect(balAddrToBanAddr(testBalAddress)).toMatchSnapshot();
  });

  test("should return BanAddress with multilingual label after cleaning non-compliant ISO code lang", async () => {
    const testBalAddress: BalAdresse = {
      ...defaultTestBalAddress,
      uid_adresse: idSampleWithAllIds,
      lieudit_complement_nom: 'Ancien chemin du hero',
      lieudit_complement_nom_unknowISO: 'Anything',
    };

    expect(balAddrToBanAddr(testBalAddress)).toMatchSnapshot();
  });
});
