import { getDepartementCodeFromCog, getRegionFromDepartementCode } from './formatters.helpers.js';
import type { NdjsonHeader, RawCommonToponym, RawDistrict, RawEntity } from '../types.js';

const IS_TEST_ENV = process.env.NODE_ENV !== 'production';

export const rawToBan: {[key in NdjsonHeader['type']]?: (ndjsonHeader: NdjsonHeader, raw: RawEntity) => RawEntity} = {
  district: (_ndjsonHeader: NdjsonHeader, raw: RawDistrict) => ({
    id: raw?.id,
    labels: raw?.labels,
    config: raw?.config,
    meta: {
      ban: {
        DEPRECATED_id: raw?.meta?.insee?.cog ?? null,
        type: 'unknown',
        region: getRegionFromDepartementCode(getDepartementCodeFromCog(raw?.meta?.insee?.cog ?? null, IS_TEST_ENV), IS_TEST_ENV),
        departement: getDepartementCodeFromCog(raw?.meta?.insee?.cog ?? null, IS_TEST_ENV),
        composedAt: raw?.meta?.bal?.dateRevision ?? null,
        dateRevision: raw?.meta?.bal?.dateRevision ?? null,
        withBanId: Boolean(raw?.id),
        BETA_hashIdFix: '',
      },
      insee: {
        cog: raw?.meta?.insee?.cog ?? null,
        mainCog: raw?.meta?.insee?.mainCog ?? null,
        isMain: raw?.meta?.insee?.isMain ?? null,
      },
      laPoste: {
        codePostal: [],
      },
    },
    legalityDate: raw?.updateDate ?? null,
    lastRecordDate: raw?.meta?.bal?.dateRevision ?? null,
    isActive: raw?.isActive ?? null,
  }),

  toponym: (_ndjsonHeader: NdjsonHeader, raw: RawCommonToponym) => ({
    id: raw?.id,
    districtID: raw?.districtID,
    labels: raw?.labels,
    positions: raw?.geometry ? [{
      type: 'segment',
      geometry: raw.geometry,
    }] : [],
    meta: {
      ban: {
        DEPRECATED_id: raw?.meta?.bal?.deprecatedID ?? null,
        DEPRECATED_groupId: raw?.meta?.bal?.deprecatedGroupID ?? null,
        DEPRECATED_cleInteropBAL: raw?.meta?.bal?.cleInterop ?? null,
        DEPRECATED_cleInteropBAN: raw?.meta?.ban?.cleInteropBAN ?? null,
        targetKeys: raw?.targetKeys,
        category: 'voie',
        sources: raw?.sources ?? ['bal'],
        sourceNomVoie: raw?.sourceNomVoie,
        BETA_hashIdFix: '',
      },
      dgfip: {
        BETA_cadastre: [],
        BETA_codeFantoir: '',
      },
      laPoste: {
        codePostal: [],
      },
    },
    legalityDate: raw?.updateDate ?? null,
    lastRecordDate: raw?.meta?.bal?.dateRevision ?? null,
  }),

  address: (_ndjsonHeader: NdjsonHeader, raw: RawCommonToponym) => ({
    id: raw?.id,
    mainToponymID: raw?.mainCommonToponymID ?? null,
    secondaryToponymIDs: raw?.secondaryCommonToponymIDs ?? null,
    districtID: raw?.districtID ?? null,
    labels: raw?.labels ?? [],
    number: raw?.number ?? null,
    suffix: raw?.suffix ?? null,
    certified: raw?.certified ?? false,
    positions: raw?.positions ?? [],
    meta: {
      ban: {
        DEPRECATED_id: raw?.meta?.ban?.cleInteropBAN ?? null,
        DEPRECATED_cleInteropBAL: raw?.meta?.bal?.cleInterop ?? null,
        DEPRECATED_cleInteropBAN: raw?.meta?.ban?.cleInteropBAN ?? null,
        targetKeys: raw?.meta?.ban?.targetKeys ?? null,
        sources: raw?.sources ?? [raw?.sources?.[0]],
        sourcePosition: raw?.sourcePosition ?? 'bal',
        hashIdFix: raw?.meta?.idfix?.hash ?? '',
      },
      dgfip: {
        cadastre: raw?.meta?.cadastre?.ids ?? [],
        BETA_fantoir: raw?.meta?.dgfip?.fantoir ?? '',
      },
      insee: {
        cog: raw?.meta?.insee?.cog ?? null,
        BETA_mainCog: raw?.meta?.insee?.mainCog ?? '',
        BETA_isMainCog: raw?.meta?.insee?.isMain ?? '',
      },
      laPoste: {
        codePostal: raw?.meta?.laPoste?.codePostal ?? null,
      },
      rnb: {
        positions: raw?.meta?.rnb?.positions ?? [],
      },
    },
    legalityDate: raw?.updateDate ?? null,
    lastRecordDate: raw?.meta?.bal?.dateRevision ?? null,
  }),
};

export const banToStandardFr = {
  district: {
    typeName: 'commune',
    excludedKeysOfCompare: ['dateDerniereIntegrationBAN'],
    formater: (_ndjsonHeader: NdjsonHeader, raw: RawDistrict) => ({
      idCommune: raw?.id,
      nomCommune: raw?.labels?.[0] ? {
        codeLangue: raw.labels[0].isoCode,
        nom: raw.labels[0].value,
      } : undefined,
      nomCommuneMultilingue: raw.labels && raw.labels.length > 1
        ? raw.labels.slice(1).map((label: { isoCode: string; value: string }) => ({
          codeLangue: label.isoCode,
          nom: label.value,
        }))
        : [],
      codeINSEE: raw?.meta?.insee?.cog ?? null,
      statutCommune: raw.isActive
        ? raw?.meta?.insee?.isMain
          ? 'commune-actuelle'
          : 'commune-historique'
        : 'commune-supprimee',
      dateDerniereIntegrationBAN: raw?.meta?.bal?.dateRevision ?? null,
    }),
  },

  toponym: {
    typeName: 'odonyme',
    excludedKeysOfCompare: ['dateDerMaj', 'dateIntegrationBAN'],
    formater: (_ndjsonHeader: NdjsonHeader, raw: RawCommonToponym) => ({
      idOdonyme: raw?.id,
      idCommune: raw?.districtID,
      cleCiblage: raw?.meta?.ban?.targetKeys ?? null,
      DEPRECIE_cleInterop: raw?.meta?.ban?.DEPRECATED_cleInteropBAN ?? null,
      nomOdonyme: raw?.labels?.[0] ? {
        codeLangue: raw.labels[0].isoCode,
        nom: raw.labels[0].value,
      } : undefined,
      nomOdonymeMultilingue: raw.labels && raw.labels.length > 1
        ? raw.labels.slice(1).map((label: { isoCode: string; value: string }) => ({
          codeLangue: label.isoCode,
          nom: label.value,
        }))
        : [],
      dateDerMaj: raw?.legalityDate ?? null,
      dateIntegrationBAN: raw?.lastRecordDate ?? null,
    }),
  },

  address: {
    typeName: 'adresse',
    excludedKeysOfCompare: ['dateDerMaj', 'dateIntegrationBAN'],
    formater: (_ndjsonHeader: NdjsonHeader, raw: RawCommonToponym) => ({
      idAdresse: raw?.id,
      idOdonyme: raw?.mainToponymID,
      idOdonymesComplementaires: raw?.secondaryToponymIDs ?? [],
      idCommune: raw?.districtID,
      idCommuneHistorique: raw?.meta?.insee?.cog ?? null,
      cleCiblage: raw?.meta?.ban?.targetKeys ?? null,
      DEPRECIE_cleInterop: raw?.meta?.ban?.DEPRECATED_cleInteropBAN ?? null,
      numero: raw?.number ?? null,
      indiceRepetition: raw?.suffix ?? null,
      nomComplementaire: raw?.labels?.[0] ? {
        codeLangue: raw.labels[0].isoCode,
        nom: raw.labels[0].value,
      } : undefined,
      certification: raw?.certified ?? false,
      position: raw.positions?.[0] ? {
        type: raw.positions[0].type,
        geometry: raw.positions[0].geometry,
      } : null,
      positionsComplementaires: raw?.positions && raw.positions.length > 1
        ? raw.positions.slice(1).map((pos: any) => ({
          type: pos.type,
          geometry: pos.geometry,
        }))
        : [],
      source: raw?.sources ?? ['commune'],
      parcellesCadastrales: raw?.meta?.cadastre?.ids ?? [],
      codePostal: raw?.meta?.laPoste?.codePostal ?? null,
      dateDerMaj: raw?.legalityDate ?? null,
      dateIntegrationBAN: raw?.lastRecordDate ?? null,
    }),
  },
};

export const banToStandardFrInt = {
  district: {
    typeName: 'district',
    excludedKeysOfCompare: ['BANlastInsertDate'],
    formater: (_ndjsonHeader: NdjsonHeader, raw: RawDistrict) => ({
      districtId: raw?.id,
      districtLabel: raw?.labels?.[0] ? {
        codeLang: raw.labels[0].isoCode,
        value: raw.labels[0].value,
      } : undefined,
      districtLabelMultilingual: raw.labels && raw.labels.length > 1
        ? raw.labels.slice(1).map((label: { isoCode: string; value: string }) => ({
          codeLang: label.isoCode,
          value: label.value,
        }))
        : [],
      INSEEcode: raw?.meta?.insee?.cog ?? null,
      districtStatus: raw.isActive
        ? raw?.meta?.insee?.isMain
          ? 'current'
          : 'historical'
        : 'deleted',
      BANlastInsertDate: raw?.meta?.bal?.dateRevision ?? null,
    }),
  },

  toponym: {
    typeName: 'toponym',
    excludedKeysOfCompare: ['dateDerMaj', 'BANlastInsertDate'],
    formater: (_ndjsonHeader: NdjsonHeader, raw: RawCommonToponym) => ({
      toponymId: raw?.id,
      districtId: raw?.districtID,
      targetKeys: raw?.meta?.ban?.targetKeys ?? null,
      DEPRECATED_interopKey: raw?.meta?.ban?.DEPRECATED_cleInteropBAN ?? null,
      toponymLabel: raw?.labels?.[0] ? {
        codeLang: raw.labels[0].isoCode,
        value: raw.labels[0].value,
      } : undefined,
      toponymLabelMultilingual: raw.labels && raw.labels.length > 1
        ? raw.labels.slice(1).map((label: { isoCode: string; value: string }) => ({
          codeLang: label.isoCode,
          value: label.value,
        }))
        : [],
      dateDerMaj: raw?.legalityDate ?? null,
      BANlastInsertDate: raw?.lastRecordDate ?? null,
    }),
  },

  address: {
    typeName: 'address',
    excludedKeysOfCompare: ['dateDerMaj', 'BANlastInsertDate'],
    formater: (_ndjsonHeader: NdjsonHeader, raw: RawCommonToponym) => ({
      addressId: raw?.id,
      toponymId: raw?.mainToponymID,
      secondaryToponymIds: raw?.secondaryToponymIDs ?? [],
      districtId: raw?.districtID,
      historicalDistrictId: raw?.meta?.insee?.cog ?? null,
      targetKeys: raw?.meta?.ban?.targetKeys ?? null,
      DEPRECATED_interopKey: raw?.meta?.ban?.DEPRECATED_cleInteropBAN ?? null,
      number: raw?.number ?? null,
      repetitionIndex: raw?.suffix ?? null,
      additionalLabel: raw?.labels?.[0] ? {
        codeLangue: raw.labels[0].isoCode,
        nom: raw.labels[0].value,
      } : undefined,
      certified: raw?.certified ?? false,
      position: raw.positions?.[0] ? {
        type: raw.positions[0].type,
        geometry: raw.positions[0].geometry,
      } : null,
      secondaryPositions: raw?.positions && raw.positions.length > 1
        ? raw.positions.slice(1).map((pos: any) => ({
          type: pos.type,
          geometry: pos.geometry,
        }))
        : [],
      origin: raw?.sources ?? ['commune'],
      cadastralParcels: raw?.meta?.cadastre?.ids ?? [],
      postalCode: raw?.meta?.laPoste?.codePostal ?? null,
      dateDerMaj: raw?.legalityDate ?? null,
      BANlastInsertDate: raw?.lastRecordDate ?? null,
    }),
  },
};
