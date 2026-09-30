import type { DataType, NdjsonHeader, RawEntity } from '../types.js';

const asRecord = (value: unknown): RawEntity => (
  value && typeof value === 'object' ? value as RawEntity : {}
);

const optional = (key: string, value: unknown) => value == null ? {} : { [key]: value };

const postalCodes = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string')
  : typeof value === 'string' ? [value] : [];

/** Implements the current public Raw contract (BAN/DIFF v0.4). */
export const toRawEntity = (header: NdjsonHeader, rawValue: RawEntity): RawEntity => {
  const raw = asRecord(rawValue);
  const rawMeta = asRecord(raw.meta);
  const insee = asRecord(rawMeta.insee);
  const headerMeta = asRecord(header.meta);
  const headerInsee = asRecord(headerMeta.insee);
  const interop = asRecord(rawMeta.interop);
  const bal = asRecord(rawMeta.bal);
  const ban = asRecord(rawMeta.ban);
  const source = typeof rawMeta.source === 'string'
    ? rawMeta.source
    : Array.isArray(raw.sources) && typeof raw.sources[0] === 'string'
      ? raw.sources[0]
      : 'assemblage';
  const base = {
    id: raw.id,
    labels: Array.isArray(raw.labels) ? raw.labels : [],
    status: raw.isActive === false ? 'disabled' : 'active',
    updatedAt: raw.updatedAt ?? raw.updateDate ?? null,
    integratedAt: raw.integratedAt ?? bal.dateRevision ?? null,
    meta: {
      insee: { cog: insee.cog ?? headerInsee.cog },
      source,
      ...(Object.keys(interop).length > 0 || bal.cleInterop || ban.cleInteropBAN ? {
        interop: {
          ...optional('balProvidedKey', interop.balProvidedKey ?? bal.cleInterop),
          ...optional('banComputedKey', interop.banComputedKey ?? ban.cleInteropBAN),
          ...optional('legacyCsvId', interop.legacyCsvId),
        },
      } : {}),
    },
    ...optional('historicalDistrictID', raw.historicalDistrictID),
    ...optional('historicalInseeCode', raw.historicalInseeCode),
  };

  if (header.type === 'district') return base;
  if (header.type === 'toponym') return {
    ...base,
    districtID: raw.districtID,
    geometry: raw.geometry,
  };

  return {
    ...base,
    districtID: raw.districtID,
    mainToponymID: raw.mainToponymID ?? raw.mainCommonToponymID,
    secondaryToponymIDs: raw.secondaryToponymIDs ?? raw.secondaryCommonToponymIDs ?? [],
    ...optional('number', raw.number),
    ...optional('suffix', raw.suffix),
    certified: raw.certified === true,
    positions: Array.isArray(raw.positions) ? raw.positions : [],
    postalCodes: postalCodes(raw.postalCodes ?? asRecord(rawMeta.laPoste).codePostal),
  };
};

export const rawFormatters = Object.fromEntries(
  (['district', 'toponym', 'address'] as DataType[]).map(type => [type, {
    converter: toRawEntity,
    formater: (_header: NdjsonHeader, raw: RawEntity) => raw,
  }])
);
