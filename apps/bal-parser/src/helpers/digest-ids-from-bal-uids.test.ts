import { describe, expect, test } from 'vitest';
import {
  idSampleWithAddressId,
  idSampleWithMainTopoId,
  idSampleWithSecondaryTopoId,
  idSampleWithDistrictId,
  idSampleWithAddressIdAndMainTopoId,
  idSampleWithAddressIdAndSecondaryTopoId,
  idSampleWithMainTopoIdAndDistrictId,
  idSampleWithAllIds,
} from './__mocks__/fake-data.js';
import digestIDsFromBalUIDs from './digest-ids-from-bal-uids.js';

describe('digestIDsFromBalUIDs', () => {
  test('should return an empty object for an undefined BanIDs', async () => {
    const id = digestIDsFromBalUIDs();
    expect(id).toMatchSnapshot();
  });
  test('should return an empty object for an empty BanIDs string', async () => {
    const id = digestIDsFromBalUIDs('');
    expect(id).toMatchSnapshot();
  });
  test('should return an object with BanID with only addrID', async () => {
    const id = digestIDsFromBalUIDs(idSampleWithAddressId);
    expect(id).toMatchSnapshot();
  });
  test('should return an object with BanID with only mainTopoID', async () => {
    const id = digestIDsFromBalUIDs(idSampleWithMainTopoId);
    expect(id).toMatchSnapshot();
  });
  test('should return an object with BanID with only secondaryTopoIDs', async () => {
    const id = digestIDsFromBalUIDs(idSampleWithSecondaryTopoId);
    expect(id).toMatchSnapshot();
  });
  test('should return an object with BanID with only districtID', async () => {
    const id = digestIDsFromBalUIDs(idSampleWithDistrictId);
    expect(id).toMatchSnapshot();
  });
  test('should return an object with BanID with addrID and mainTopoID', async () => {
    const id = digestIDsFromBalUIDs(idSampleWithAddressIdAndMainTopoId);
    expect(id).toMatchSnapshot();
  });
  test('should return an object with BanID with addrID and secondaryTopoIDs', async () => {
    const id = digestIDsFromBalUIDs(idSampleWithAddressIdAndSecondaryTopoId);
    expect(id).toMatchSnapshot();
  });
  test('should return an object with BanID with mainTopoID and districtID', async () => {
    const id = digestIDsFromBalUIDs(idSampleWithMainTopoIdAndDistrictId);
    expect(id).toMatchSnapshot();
  });
  test('should return an object with BanID with addrID, mainTopoID, secondaryTopoIDs and districtID', async () => {
    const id = digestIDsFromBalUIDs(idSampleWithAllIds);
    expect(id).toMatchSnapshot();
  });
});
