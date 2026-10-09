import type { NdjsonHeader, RawEntity } from '../types.js';
import { toRawEntity } from './raw-formatters.js';

const optional = (key: string, value: unknown) => value == null ? {} : { [key]: value };
const point = (value: RawEntity) => ({ type: value.type, coordonnees: value.coordinates });

export const toStandardFrEntity = (header: NdjsonHeader, raw: RawEntity): RawEntity => {
  const entity = toRawEntity(header, raw);
  const meta = entity.meta as RawEntity;
  const interop = (meta.interop ?? {}) as RawEntity;
  const base = {
    libelles: (entity.labels as RawEntity[]).map(label => ({ valeur: label.value, codeIso: label.isoCode })),
    statut: entity.status,
    dateDerniereMiseAJour: entity.updatedAt,
    dateIntegrationBAN: entity.integratedAt,
    metadonnees: {
      insee: { code: (meta.insee as RawEntity).cog },
      source: meta.source,
      ...(Object.keys(interop).length ? { interop: {
        ...optional('cleFournieBAL', interop.balProvidedKey),
        ...optional('cleCalculeeBAN', interop.banComputedKey),
        ...optional('idCsvHistorique', interop.legacyCsvId),
      } } : {}),
    },
    ...optional('idCommuneHistorique', entity.historicalDistrictID),
    ...optional('codeINSEECommuneHistorique', entity.historicalInseeCode),
  };
  if (header.type === 'district') return { idCommune: entity.id, ...base };
  if (header.type === 'toponym') return {
    idOdonyme: entity.id, idCommune: entity.districtID,
    geometrie: point(entity.geometry as RawEntity), ...base,
  };
  return {
    idAdresse: entity.id, idCommune: entity.districtID, idOdonyme: entity.mainToponymID,
    idsOdonymesComplementaires: entity.secondaryToponymIDs, certification: entity.certified,
    positions: (entity.positions as RawEntity[]).map(position => ({ type: position.type, geometrie: point(position.geometry as RawEntity) })),
    codesPostaux: entity.postalCodes,
    ...optional('numero', entity.number), ...optional('indiceRepetition', entity.suffix), ...base,
  };
};

export const standardFrFormatters = {
  district: { converter: toRawEntity, formater: toStandardFrEntity, typeName: 'commune' },
  toponym: { converter: toRawEntity, formater: toStandardFrEntity, typeName: 'odonyme' },
  address: { converter: toRawEntity, formater: toStandardFrEntity, typeName: 'adresse' },
};
