import Cursor from "pg-cursor";

export const VALID_FORMATS = ['raw', 'ban', 'standard-fr', 'standard-fr-int'];
export const VALID_DATA_TYPES = ["district", "toponym", "address"];

const getDepartementCodeFromCog = (cog?: string | null, isTestEnv?: boolean): string | null => {
  if (typeof cog !== 'string') {
    return null
  }

  const normalizedCog = cog.trim().toUpperCase()
  if (!normalizedCog) {
    return null
  }

  const departementCode = (normalizedCog.startsWith('97') && normalizedCog.length === 5)
    ? normalizedCog.slice(0, 3) // Overseas departments
    : normalizedCog.slice(0, 2) // Corsica & Metropolitan departments

  // Special case for Hyrules-Archipel in test environment
  if (isTestEnv && departementCode === '96') {
    return '96'
  }

  // Return null for invalid department codes
  if (!/^\d{2,3}$/.test(departementCode)) {
    return null
  }

  return departementCode;
}

const getRegionFromDepartementCode = (dep?: string | null, isTestEnv?: boolean): {code: string, nom: string} | null => {
  if (!dep) {
    return null
  }

  // Metropolitan departments
  if (['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'].includes(dep)) return {code: '84', nom: 'Auvergne-Rhone-Alpes'}
  if (['21', '25', '39', '58', '70', '71', '89', '90'].includes(dep)) return {code: '27', nom: 'Bourgogne-Franche-Comte'}
  if (['22', '29', '35', '56'].includes(dep)) return {code: '53', nom: 'Bretagne'}
  if (['18', '28', '36', '37', '41', '45'].includes(dep)) return {code: '24', nom: 'Centre-Val de Loire'}
  if (['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'].includes(dep)) return {code: '44', nom: 'Grand Est'}
  if (['02', '59', '60', '62', '80'].includes(dep)) return {code: '32', nom: 'Hauts-de-France'}
  if (['75', '77', '78', '91', '92', '93', '94', '95'].includes(dep)) return {code: '11', nom: 'Ile-de-France'}
  if (['14', '27', '50', '61', '76'].includes(dep)) return {code: '28', nom: 'Normandie'}
  if (['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'].includes(dep)) return {code: '75', nom: 'Nouvelle-Aquitaine'}
  if (['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'].includes(dep)) return {code: '76', nom: 'Occitanie'}
  if (['44', '49', '53', '72', '85'].includes(dep)) return {code: '52', nom: 'Pays de la Loire'}
  if (['04', '05', '06', '13', '83', '84'].includes(dep)) return {code: '93', nom: "Provence-Alpes-Cote d'Azur"}

  // Corsica uses 2A and 2B as department codes, but they are often represented as 94 in regional datasets
  if (['2A', '2B'].includes(dep)) return {code: '94', nom: 'Corse'}

  // Overseas departments
  if (dep === '971') return {code: '01', nom: 'Guadeloupe'}
  if (dep === '972') return {code: '02', nom: 'Martinique'}
  if (dep === '973') return {code: '03', nom: 'Guyane'}
  if (dep === '974') return {code: '04', nom: 'La Reunion'}
  if (dep === '976') return {code: '06', nom: 'Mayotte'}

  // Special case for Hyrules-Archipel in test environment
  if (isTestEnv && ['96'].includes(dep)) return {code: '96', nom: 'Royaumes-Enchantés'}

  return null
}

export const dateStringToPgTimestamptz = (dateString: string | undefined, withError: boolean = false): 'Invalid date' | string | null => {
  if(!dateString && typeof dateString !== 'string') {
    if (withError) throw new Error("Date string is required");
    return null;
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    if (withError) throw new Error("Invalid date");
    return 'Invalid date';
  }
  return date.toISOString();
}

export const getQueryParams = (params: string[], allParams: Record<string, any>) => params.map(param => allParams?.[param] || null)


// ------------------------------

export const rawToBan: {[key in NdjsonHeader['type']]?: (ndjsonHeader: NdjsonHeader, raw:RawEntity) => RawEntity} = {
  district : (ndjsonHeader: NdjsonHeader, raw: RawDistrict) => ({
    id: raw?.id,
    labels: raw?.labels,
    config: raw?.config,
    meta: {
      ban: {
        DEPRECATED_id: raw?.meta?.insee?.cog ?? null,
        type: "unknown",
        region: getRegionFromDepartementCode(getDepartementCodeFromCog(raw?.meta?.insee?.cog ?? null)),
        departement: getDepartementCodeFromCog(raw?.meta?.insee?.cog ?? null),
        composedAt: raw?.meta?.bal?.dateRevision ?? null,
        dateRevision: raw?.meta?.bal?.dateRevision ?? null,
        withBanId: Boolean(raw?.id),
        BETA_hashIdFix: "",
      },
      insee: {
        cog: raw?.meta?.insee?.cog ?? null,
        mainCog: raw?.meta?.insee?.mainCog ?? null,
        isMain: raw?.meta?.insee?.isMain ?? null,
      },
      laPoste: {
        codePostal: [], // FIXME : pas encore dispo dans le raw
      }
    },
    legalityDate: raw?.updateDate ?? null,
    lastRecordDate: raw?.meta?.bal?.dateRevision ?? null,
    isActive: raw?.isActive ?? null,
  }),

  toponym: (ndjsonHeader: NdjsonHeader, raw: RawCommonToponym) => ({
    "id": raw?.id,
    "districtID": raw?.districtID,
    "labels": raw?.labels,
    "positions": raw?.geometry ? [{
      type: "segment",
      geometry: raw.geometry,
    }] : [],
    "meta": {
      "ban": {
        "DEPRECATED_id": raw?.meta?.bal?.deprecatedID ?? null, // à vérifier si c'est dispo dans le raw
        "DEPRECATED_groupId": raw?.meta?.bal?.deprecatedGroupID ?? null, // à vérifier si c'est dispo dans le raw
        "DEPRECATED_cleInteropBAL": raw?.meta?.bal?.cleInterop ?? null,
        "DEPRECATED_cleInteropBAN": raw?.meta?.ban?.cleInteropBAN ?? null,
        "targetKeys": raw?.targetKeys,
        "category": "voie", // FIXME: A reccuperer : Voie, place et lieu-dit.
        "sources": raw?.sources ?? [
          "bal"
        ],
        "sourceNomVoie": raw?.sourceNomVoie, // FIXME: à vérifier si c'est dispo dans le raw
        "BETA_hashIdFix": "", // FIXME: à définir la logique de hashIdFix si besoin, ou laisser vide pour l'instant
      },
      "dgfip": {
        "BETA_cadastre": [], // FIXME: à vérifier si c'est dispo dans le raw
        "BETA_codeFantoir": "", // FIXME: à vérifier si c'est dispo dans le raw
      },
      laPoste: {
        codePostal: [], // FIXME : pas encore dispo dans le raw
      }
    },
    "legalityDate": raw?.updateDate ?? null,
    "lastRecordDate": raw?.meta?.bal?.dateRevision ?? null // non disponible actuellement dans le raw, à confirmer si on peut le récupérer depuis une autre source ou si on laisse null pour l'instant
  }),

  // todo: fix type error
  address: (ndjsonHeader: NdjsonHeader, raw: RawCommonToponym) => ({
    "id": raw?.id,
    "mainToponymID": raw?.mainCommonToponymID ?? null,
    "secondaryToponymIDs": raw?.secondaryCommonToponymIDs ?? null,
    "districtID": raw?.districtID ?? null,
    "labels": raw?.labels ?? [],
    "number": raw?.number ?? null,
    "suffix": raw?.suffix ?? null,
    "certified": raw?.certified ?? false,
    "positions": raw?.positions ?? [],
    "meta": {
      "ban": {
        "DEPRECATED_id": raw?.meta?.ban?.cleInteropBAN ?? null, // FIXME: Verrifier la valeur
        "DEPRECATED_cleInteropBAL": raw?.meta?.bal?.cleInterop ?? null,
        "DEPRECATED_cleInteropBAN": raw?.meta?.ban?.cleInteropBAN ?? null,
        "targetKeys": raw?.meta?.ban?.targetKeys ?? null,
        "sources": raw?.sources ?? [
          raw?.sources?.[0]
        ],
        "sourcePosition": raw?.sourcePosition ?? "bal",
        "hashIdFix": raw?.meta?.idfix?.hash ?? "",
      },
      "dgfip": {
        "cadastre": raw?.meta?.cadastre?.ids ?? [],
        "BETA_fantoir": raw?.meta?.dgfip?.fantoir ?? "",
      },
      "insee": {
        "cog": raw?.meta?.insee?.cog ?? null,
        "BETA_mainCog": raw?.meta?.insee?.mainCog ?? "",
        "BETA_isMainCog": raw?.meta?.insee?.isMain ?? "",
      },
      "laPoste": {
        "codePostal": raw?.meta?.laPoste?.codePostal ?? null,
      },
      "rnb": {
        "positions": raw?.meta?.rnb?.positions ?? [],
      }
    },
    "legalityDate": raw?.updateDate ?? null,
    "lastRecordDate": raw?.meta?.bal?.dateRevision ?? null,
  }),
}

export const banToStandardFr = {
  district : {
    typeName: "commune",
    exclutedKeysForComparison: ['dateDerniereIntegrationBAN'],
    formater : (ndjsonHeader: NdjsonHeader, raw: RawDistrict) => ({
      idCommune: raw?.id,
      nomCommune: raw?.labels?.[0] ? {
        codeLangue: raw.labels[0].isoCode,
        nom: raw.labels[0].value,
      } : undefined,
      nomCommuneMultilingue: raw.labels && raw.labels.length > 1
        ? raw.labels.slice(1).map(
            (label: { isoCode: string; value: string }) => ({
              codeLangue: label.isoCode,
              nom: label.value,
            })
          )
        : [],
      codeINSEE: raw?.meta?.insee?.cog ?? null,
      statutCommune: raw.isActive // FIXME: AJOUTER L'ID de la commune Actuelle 
        ?raw?.meta?.insee?.isMain
          ? "commune-actuelle"
          : "commune-historique"
        : "commune-supprimée",  // FIXME : Trop limitant par rapport aux info du COG
      dateDerniereIntegrationBAN: raw?.meta?.bal?.dateRevision ?? null,
    }),
  },

  toponym: {
    typeName: "odonyme",
    exclutedKeysForComparison: ['dateDerMaj', 'dateIntegrationBAN'],
    formater : (ndjsonHeader: NdjsonHeader, raw: RawCommonToponym) => ({
      idOdonyme: raw?.id,
      idCommune: raw?.districtID,
      cleCiblage: raw?.meta?.ban?.targetKeys ?? null,
      DEPRECIE_cleInterop: raw?.meta?.ban?.DEPRECATED_cleInteropBAN ?? null,
      nomOdonyme: raw?.labels?.[0] ? {
        codeLangue: raw.labels[0].isoCode,
        nom: raw.labels[0].value,
      } : undefined,
      nomOdonymeMultilingue: raw.labels && raw.labels.length > 1
        ? raw.labels.slice(1).map(
            (label: { isoCode: string; value: string }) => ({
              codeLangue: label.isoCode,
              nom: label.value,
            })
          )
        : [],
      dateDerMaj: raw?.legalityDate ?? null, // Date fournis par la BAL
      dateIntegrationBAN: raw?.lastRecordDate ?? null,
    }),
  },


  address: {
    typeName: "adresse",
    exclutedKeysForComparison: ['dateDerMaj', 'dateIntegrationBAN'],
    formater : (ndjsonHeader: NdjsonHeader, raw: RawCommonToponym) => ({
      idAdresse: raw?.id,
      idOdonyme: raw?.mainToponymID,
      idOdonymesComplementaires: raw?.secondaryToponymIDs ?? [],
      idCommune: raw?.districtID,
      idCommuneHistorique: raw?.meta?.insee?.cog ?? null, // FIXME: ID ou code de la commune historique quand on aura accès à cette info dans le raw
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
      source: raw?.sources ?? ["commune"], // FIXME : Pour export prevoir "assemblage" possible.
      parcellesCadastrales: raw?.meta?.cadastre?.ids ?? [],
      codePostal: raw?.meta?.laPoste?.codePostal ?? null,
      dateDerMaj: raw?.legalityDate ?? null, // Date fournis par la BAL
      dateIntegrationBAN: raw?.lastRecordDate ?? null, 
    }),
  },
}

export const banToStandardFrInt = {
  district : {
    typeName: "district",
    exclutedKeysForComparison: ['BANlastInsertDate'],
    formater : (ndjsonHeader: NdjsonHeader, raw: RawDistrict) => ({
      districtId: raw?.id,
      districtLabel: raw?.labels?.[0] ? {
        codeLang: raw.labels[0].isoCode,
        value: raw.labels[0].value,
      } : undefined,
      districtLabelMultilingual: raw.labels && raw.labels.length > 1
        ? raw.labels.slice(1).map(
            (label: { isoCode: string; value: string }) => ({
              codeLang: label.isoCode,
              value: label.value,
            })
          )
        : [],
      INSEEcode: raw?.meta?.insee?.cog ?? null,
      districtStatus: raw.isActive // FIXME: AJOUTER L'ID de la commune Actuelle 
        ?raw?.meta?.insee?.isMain
          ? "current"
          : "historical"
        : "deleted",  // FIXME : Trop limitant par rapport aux info du COG
      BANlastInsertDate: raw?.meta?.bal?.dateRevision ?? null,
    }),
  },

  toponym: {
    typeName: "toponym",
    exclutedKeysForComparison: ['dateDerMaj', 'BANlastInsertDate'],
    formater : (ndjsonHeader: NdjsonHeader, raw: RawCommonToponym) => ({
      toponymId: raw?.id,
      districtId: raw?.districtID,
      targetKey: raw?.meta?.ban?.targetKeys ?? null,
      DEPRECATED_interopKey: raw?.meta?.ban?.DEPRECATED_cleInteropBAN ?? null,
      toponymLabel: raw?.labels?.[0] ? {
        codeLang: raw.labels[0].isoCode,
        value: raw.labels[0].value,
      } : undefined,
      toponymLabelMultilingual: raw.labels && raw.labels.length > 1
        ? raw.labels.slice(1).map(
            (label: { isoCode: string; value: string }) => ({
              codeLang: label.isoCode,
              value: label.value,
            })
          )
        : [],
      dateDerMaj: raw?.legalityDate ?? null, // Date fournis par la BAL
      BANlastInsertDate: raw?.lastRecordDate ?? null,
    }),
  },


  address: {
    typeName: "address",
    exclutedKeysForComparison: ['dateDerMaj', 'BANlastInsertDate'],
    formater : (ndjsonHeader: NdjsonHeader, raw: RawCommonToponym) => ({
      addressId: raw?.id,
      toponymId: raw?.mainToponymID,
      secondaryToponymIds: raw?.secondaryToponymIDs ?? [],
      districtId: raw?.districtID,
      historicalDistrictId: raw?.meta?.insee?.cog ?? null, // FIXME: ID ou code de la commune historique quand on aura accès à cette info dans le raw
      targetKey: raw?.meta?.ban?.targetKeys ?? null,
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
      origin: raw?.sources ?? ["commune"], // FIXME : Pour export prevoir "assemblage" possible.
      cadastralParcels: raw?.meta?.cadastre?.ids ?? [],
      postalCode: raw?.meta?.laPoste?.codePostal ?? null,
      dateDerMaj: raw?.legalityDate ?? null, // Date fournis par la BAL
      BANlastInsertDate: raw?.lastRecordDate ?? null, 
    }),
  },
}

// ------------------------------

type FilterFunction = (before?: Record<string, unknown> | null, after?: Record<string, unknown> | null, excludeKeys?: string[]) => boolean;

interface MetaObjectLine {
  v: number;
  note: string;
  generatedAt: string;
  [key: string]: unknown;
}

export const getMetaLine = (note: string, extra?: Record<string, unknown>) => {
  return JSON.stringify({
    meta: {
      v: 1,
      note,
      ...extra,
      generatedAt: new Date().toISOString(),
    }
  } as { meta: MetaObjectLine }) + "\n"
};

export const getSnapshotObjLine = (
  dataRaw: DataLine,
  formatConfigs: FormatConfigs = {},
): DataLine | null => {
  if (!('data' in dataRaw)) return null;

  const { data, ...ndjsonHeader } = dataRaw;
  const { type, nodekey }: NdjsonHeader = ndjsonHeader;
  const converter = type && rawToBan[type] ? rawToBan[type] : () => data;
  const formater = type && formatConfigs[type]?.formater ? formatConfigs[type].formater : (ndjsonHeader: NdjsonHeader, raw: RawEntity) => raw || null;

  const renamedType = (formatConfigs[type]?.typeName ?? type) as DataType;
  const formattedData = formater(ndjsonHeader, converter(ndjsonHeader, data));

  return {
    type: renamedType,
    nodekey,
    data: formattedData,
  }
}

const getObjectForFilter = (data: Record<string, unknown>, excludeKeys: string[] = []) => {
  return Object.entries(data).reduce((acc, [key, value]) => {
    if (!excludeKeys.includes(key)) {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, unknown>);
}

const filter: FilterFunction = (before, after, excludeKeys) => {
  if ((before && !after) || (!before && after)) return true; // Keep all 'created' and 'disabled' events
  if (!before && !after) return false; // Exclude events where both before and after are null/undefined (shouldn't happen but just in case)
  const dataBeforeForFilter = getObjectForFilter(before || {}, excludeKeys);
  const dataAfterForFilter = getObjectForFilter(after || {}, excludeKeys);
  const beforeAsString = JSON.stringify(dataBeforeForFilter);
  const afterAsString = JSON.stringify(dataAfterForFilter);
  const isDifferent = beforeAsString !== afterAsString;
  return isDifferent;
};

export const getDiffObjLine = (
  dataRaw: DataLine,
  formatConfigs: FormatConfigs = {},
): DataLine | null => {
  if (!('datas' in dataRaw)) return null;

  const [afterRaw, beforeRaw] = dataRaw.datas;
  const { datas, ...ndjsonHeader } = dataRaw;
  const { event, type, nodekey }: NdjsonHeader = ndjsonHeader;
  const converter = type && rawToBan[type] ? rawToBan[type] : () => (afterRaw || beforeRaw);
  const formater = type && formatConfigs[type]?.formater ? formatConfigs[type].formater : (ndjsonHeader: NdjsonHeader, raw: RawEntity) => raw || null;

  const renamedType = (formatConfigs[type]?.typeName ?? type) as DataType;
  const dataAfter = formater(ndjsonHeader, converter(ndjsonHeader, afterRaw));
  const dataBefore = formater(ndjsonHeader, converter(ndjsonHeader, beforeRaw));
  const compareFuncExcludeKeys = formatConfigs[type]?.exclutedKeysForComparison ?? ([] as string[]);

  // Skip this line if it doesn't pass the filter
  if (event === 'updated' && !filter(dataBefore, dataAfter, compareFuncExcludeKeys)) {
    return null;
  }

  return {
    event,
    type: renamedType,
    nodekey,
    datas: [
      ...(event !== 'disabled' ? ([dataAfter]) : []),
      ...(event !== 'created' ? ([dataBefore]) : [])
    ]
  }
}

// ------------------------------
// Stream Helper functions
// ------------------------------

function readCursor(cursor: Cursor, size: number) {
  return new Promise((resolve, reject) => {
    cursor.read(size, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

export function closeCursor(cursor: Cursor) {
  return new Promise((resolve) => {
    try {
      cursor.close(() => resolve(true));
    } catch {
      resolve(false);
    }
  });
}

type WritableTarget = {
  write: (chunk: string) => boolean;
  once: (event: 'drain', listener: () => void) => void;
};

function waitForDrain(stream: WritableTarget) {
  return new Promise<void>((resolve) => {
    stream.once('drain', resolve);
  });
}

export async function streamCursorData({
  cursor,
  fetchSize,
  dataName,
  format,
  output,
  banFormatter = (objLine: DataLine, converters?: FormatConfigs) => objLine,
  converters = {},
  isAborted,
}: {
  cursor: Cursor;
  fetchSize: number;
  dataName: string;
  format: string;
  output: WritableTarget;
  banFormatter: BanFormatter;
  converters?: Formatters;
  isAborted: () => boolean;
}) {
  const stats: Record<string, number> = {
    count: 0,
  };

  while (!isAborted()) {
    const rows = await readCursor(cursor, fetchSize) as Record<string, unknown>[];
    if (!rows.length) break;

    for (const row of rows) {
      const line = row[dataName];

      if (line == null) continue;
      const objLineRaw = typeof line === "string" ? JSON.parse(line) : {};

      let objLine = null;

      if( format === 'ban')
        objLine = banFormatter(objLineRaw);
      else if(format in converters)
        objLine = banFormatter(objLineRaw, converters[format]);
      else
        objLine = objLineRaw;

      if (!objLine) continue;

      if (!output.write(`${JSON.stringify(objLine)}\n`)) {
        await waitForDrain(output);
        if (isAborted()) break;
      }

      stats.count += 1;

      if (objLine.event) {
        stats[objLine.event] = (stats[objLine.event] || 0) + 1;
      }
    }
  }

  return stats;
}
