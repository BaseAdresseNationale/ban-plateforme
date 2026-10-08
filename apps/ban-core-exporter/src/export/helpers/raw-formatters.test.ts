import { describe, expect, it } from 'vitest';

import { toRawEntity } from './raw-formatters.js';
import { toStandardFrEntity } from './standard-fr-formatters.js';

const districtId = '11111111-1111-4111-8111-111111111111';
const toponymId = '22222222-2222-4222-8222-222222222222';
const addressId = '33333333-3333-4333-8333-333333333333';

const toponym = {
  id: toponymId,
  districtID: districtId,
  labels: [{ isoCode: 'fra', value: 'Rue des Lilas' }],
  geometry: { type: 'Point', coordinates: [2.35, 48.85] },
  isActive: true,
  updateDate: '2026-01-15T00:00:00.000Z',
  meta: { bal: { dateRevision: '2026-01-14T00:00:00.000Z' } },
};

const address = {
  id: addressId,
  districtID: districtId,
  mainCommonToponymID: toponymId,
  secondaryCommonToponymIDs: [],
  labels: [{ isoCode: 'fra', value: '12 Rue des Lilas' }],
  certified: true,
  positions: [{ type: 'entrance', geometry: { type: 'Point', coordinates: [2.35, 48.85] } }],
  isActive: true,
  updateDate: '2026-01-15T00:00:00.000Z',
  meta: { bal: { dateRevision: '2026-01-14T00:00:00.000Z' } },
};

describe('v0.4 INSEE serialization', () => {
  it.each([
    ['toponym', toponym, 'odonyme'],
    ['address', address, 'adresse'],
  ] as const)('uses the envelope INSEE code for %s in Raw and Standard FR', (type, entity, standardFrType) => {
    const header = { type, nodeKey: `${type}:::${entity.id}`, meta: { insee: { cog: '75056' } } };
    const standardFrEntity = toStandardFrEntity(header, entity);

    expect(toRawEntity(header, entity).meta).toMatchObject({ insee: { cog: '75056' } });
    expect(standardFrEntity.metadonnees).toMatchObject({ insee: { code: '75056' } });
    expect(standardFrEntity[standardFrType === 'odonyme' ? 'idOdonyme' : 'idAdresse']).toBe(entity.id);
  });
});

describe('optional address suffix', () => {
  const header = { type: 'address' as const, meta: { insee: { cog: '75056' } } };

  it.each([undefined, null, ''])('omits an absent suffix (%s) in Raw and Standard FR', suffix => {
    const entity = { ...address, suffix };
    expect(toRawEntity(header, entity)).not.toHaveProperty('suffix');
    expect(toStandardFrEntity(header, entity)).not.toHaveProperty('indiceRepetition');
    expect(entity.suffix).toBe(suffix);
  });

  it.each(['bis', 'ter', 'A'])('preserves the populated suffix %s in both formats', suffix => {
    const entity = { ...address, suffix };
    expect(toRawEntity(header, entity)).toHaveProperty('suffix', suffix);
    expect(toStandardFrEntity(header, entity)).toHaveProperty('indiceRepetition', suffix);
  });
});
