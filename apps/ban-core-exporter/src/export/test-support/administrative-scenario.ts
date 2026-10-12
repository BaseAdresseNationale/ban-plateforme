import type { DataType, DiffLine, RawEntity, SnapshotLine } from '../types.js';

// Entirely fictional. No database rows or department-96 fixture kit are required.
export const scenarioTimes = {
  start: '2026-04-06T00:00:00+02:00',
  middle: '2026-04-13T00:00:00+02:00',
  end: '2026-04-20T00:00:00+02:00',
  generated: '2026-10-12T00:00:00Z',
};
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const scenarioIds = {
  north: uuid(1), south: uuid(2), merged: uuid(3),
  northToponym: uuid(11), southToponym: uuid(12), newToponym: uuid(13),
  firstAddress: uuid(21), secondAddress: uuid(22), thirdAddress: uuid(23),
  fourthAddress: uuid(24), transientAddress: uuid(25),
};
const row = (type: DataType, data: RawEntity): SnapshotLine => ({ type, data });
const event = (type: DataType, change: 'created' | 'updated' | 'disabled', after: RawEntity, before: RawEntity | null): DiffLine => ({
  type, event: change, datas: [after, before],
});
const base = (id: string, label: string, cog: string): RawEntity => ({
  id, labels: [{ isoCode: 'fra', value: label }], isActive: true,
  updateDate: '2026-03-01T00:00:00Z', integratedAt: '2026-03-01T00:00:00Z',
  meta: { insee: { cog }, source: 'bal', interop: { banComputedKey: `clé-${cog}-${id}` } },
});
const address = (id: string, districtID: string, mainToponymID: string, cog: string): RawEntity => ({
  ...base(id, 'Adresse fictive', cog), labels: [], districtID, mainToponymID,
  secondaryToponymIDs: [], certified: false, postalCodes: [],
  positions: [{ type: 'entrance', geometry: { type: 'Point', coordinates: [2, 48] } }],
});

export const getAdministrativeScenario = () => {
  const ids = scenarioIds;
  const north = { ...base(ids.north, 'Commune fictive du Nord', '96001'), config: { logo: 'ancien' } };
  const south = base(ids.south, 'Commune fictive du Sud', '96002');
  const northToponym = { ...base(ids.northToponym, 'Rue du Nord', '96001'), districtID: ids.north,
    geometry: { type: 'Point', coordinates: [2, 48] } };
  const southToponym = { ...base(ids.southToponym, 'Rue du Sud', '96002'), districtID: ids.south, geometry: null };
  const firstAddress = address(ids.firstAddress, ids.north, ids.northToponym, '96001'); // Number omitted.
  const secondAddress = { ...address(ids.secondAddress, ids.south, ids.southToponym, '96002'), number: 12 };
  const start = [row('district', north), row('district', south), row('toponym', northToponym),
    row('toponym', southToponym), row('address', firstAddress), row('address', secondAddress)];

  const fusionDate = '2026-04-09T10:00:00Z';
  const merged = { ...base(ids.merged, 'Commune fictive Réunie', '96003'), updateDate: fusionDate, integratedAt: fusionDate };
  const move = (source: RawEntity, previousDistrict: string, previousCog: string): RawEntity => ({
    ...structuredClone(source), districtID: ids.merged,
    historicalDistrictID: previousDistrict, historicalInseeCode: previousCog, updateDate: fusionDate,
    meta: { ...structuredClone(source.meta), insee: { cog: '96003' } },
  });
  const movedNorthToponym = move(northToponym, ids.north, '96001');
  const movedSouthToponym = move(southToponym, ids.south, '96002');
  const movedFirstAddress = move(firstAddress, ids.north, '96001');
  const movedSecondAddress = move(secondAddress, ids.south, '96002');
  const thirdAddress = { ...address(ids.thirdAddress, ids.merged, ids.northToponym, '96003'), number: 0,
    secondaryToponymIDs: [ids.southToponym], updateDate: '2026-04-10T10:00:00Z', integratedAt: '2026-04-10T10:00:00Z' };
  const middle = [row('district', merged), row('toponym', movedNorthToponym), row('toponym', movedSouthToponym),
    row('address', movedFirstAddress), row('address', movedSecondAddress), row('address', thirdAddress)];
  const firstDiff = [event('district', 'created', merged, null), event('address', 'created', thirdAddress, null),
    event('toponym', 'updated', movedNorthToponym, northToponym), event('toponym', 'updated', movedSouthToponym, southToponym),
    event('address', 'updated', movedFirstAddress, firstAddress), event('address', 'updated', movedSecondAddress, secondAddress),
    event('district', 'disabled', { ...north, isActive: false, updateDate: fusionDate }, north),
    event('district', 'disabled', { ...south, isActive: false, updateDate: fusionDate }, south)];

  const changeDate = '2026-04-16T10:00:00Z';
  const renamed = { ...structuredClone(merged), labels: [{ isoCode: 'fra', value: 'Commune fictive Réunie-sur-Rivière' }], updateDate: changeDate };
  const renamedToponym = { ...structuredClone(movedNorthToponym), labels: [{ isoCode: 'fra', value: 'Rue de la Réunion' }], updateDate: changeDate };
  const changedThirdAddress = { ...structuredClone(thirdAddress), certified: true, updateDate: changeDate };
  const newToponym = { ...base(ids.newToponym, 'Impasse fictive', '96003'), districtID: ids.merged, geometry: null,
    updateDate: changeDate, integratedAt: changeDate };
  const fourthAddress = { ...address(ids.fourthAddress, ids.merged, ids.newToponym, '96003'), number: 4,
    updateDate: changeDate, integratedAt: changeDate };
  const transient = { ...address(ids.transientAddress, ids.merged, ids.newToponym, '96003'), isActive: false,
    updateDate: '2026-04-18T10:00:00Z', integratedAt: '2026-04-17T10:00:00Z' };
  const technicalSecondAddress = structuredClone(movedSecondAddress);
  technicalSecondAddress.updateDate = '2026-04-17T10:00:00Z';
  technicalSecondAddress.meta.interop.banComputedKey = 'clé-recalculée-sans-changement-métier';
  const secondDiff = [event('toponym', 'created', newToponym, null), event('address', 'created', fourthAddress, null),
    event('address', 'created', transient, null), event('district', 'updated', renamed, merged),
    event('toponym', 'updated', renamedToponym, movedNorthToponym),
    event('address', 'updated', changedThirdAddress, thirdAddress),
    event('address', 'updated', technicalSecondAddress, movedSecondAddress), // Must not be emitted.
    event('address', 'disabled', { ...movedFirstAddress, isActive: false, updateDate: changeDate }, movedFirstAddress)];
  const end = [row('district', renamed), row('toponym', renamedToponym), row('toponym', movedSouthToponym),
    row('toponym', newToponym), row('address', technicalSecondAddress), row('address', changedThirdAddress), row('address', fourthAddress)];
  return { start, middle, end, firstDiff, secondDiff };
};
