import { rawToBan } from './formatters.js';
import { isUnlike } from './ndjson-data-line.helpers.js';
import type {
  DataLine,
  DataType,
  FormatConfigs,
  NdjsonHeader,
  RawEntity,
} from '../types.js';

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
    },
  } as { meta: MetaObjectLine }) + '\n';
};

const presentArray = (value: unknown) => Array.isArray(value) && value.length > 0 ? value : undefined;

/** Builds the current Raw stream opening line (BAN/DIFF v0.4). */
export const getRawStartLine = (exportType: string, params: Record<string, unknown>, dataTypes: string[]) => {
  const period = exportType === 'diff'
    ? { from: params.from, to: params.to }
    : { at: params.at };

  return JSON.stringify({
    meta: {
      note: 'stream-start',
      formatVersion: '0.4',
      exportType,
      format: 'raw',
      dataTypes,
      departments: params.departements ?? [],
      ...period,
      ...(presentArray(params.address_ids) ? { addressIds: params.address_ids } : {}),
      ...(presentArray(params.common_toponym_ids) ? { toponymIds: params.common_toponym_ids } : {}),
      ...(presentArray(params.district_ids) ? { districtIds: params.district_ids } : {}),
    },
  }) + '\n';
};

/** Builds the current Raw stream closing line (BAN/DIFF v0.4). */
export const getRawEndLine = (stats: Record<string, Record<string, number>>) => JSON.stringify({
  meta: {
    note: 'stream-end',
    generatedAt: new Date().toISOString(),
    stats,
  },
}) + '\n';

const standardFrType = (type: string) => ({ district: 'commune', toponym: 'odonyme', address: 'adresse' }[type] ?? type);

/** Builds the current Standard FR stream opening line (BAN/DIFF v0.4). */
export const getStandardFrStartLine = (exportType: string, params: Record<string, unknown>, dataTypes: string[]) => {
  const period = exportType === 'diff' ? { de: params.from, a: params.to } : { a: params.at };
  return JSON.stringify({ metadonnees: {
    note: 'stream-start', versionFormat: '0.4', typeExport: exportType, format: 'standard-fr',
    typesDonnees: dataTypes.map(standardFrType), departements: params.departements ?? [], ...period,
    ...(presentArray(params.address_ids) ? { idsAdresses: params.address_ids } : {}),
    ...(presentArray(params.common_toponym_ids) ? { idsOdonymes: params.common_toponym_ids } : {}),
    ...(presentArray(params.district_ids) ? { idsCommunes: params.district_ids } : {}),
  } }) + '\n';
};

export const getStandardFrEndLine = (stats: Record<string, Record<string, number>>) => JSON.stringify({
  metadonnees: {
    note: 'stream-end', genereLe: new Date().toISOString(),
    statistiques: Object.fromEntries(Object.entries(stats).map(([type, value]) => [standardFrType(type), value])),
  },
}) + '\n';

export const getSnapshotObjLine = (
  dataRaw: DataLine,
  formatConfigs: FormatConfigs = {}
) => {
  if (!('data' in dataRaw)) {
    return null;
  }

  const { data, ...ndjsonHeader } = dataRaw as { data: RawEntity } & NdjsonHeader;
  const { type, nodeKey, nodekey }: NdjsonHeader & { nodeKey?: string } = ndjsonHeader;
  const converter = formatConfigs[type]?.converter ?? (type && rawToBan[type] ? rawToBan[type] : () => data);
  const formater = type && formatConfigs[type]?.formater
    ? formatConfigs[type].formater
    : (_ndjsonHeader: NdjsonHeader, raw: RawEntity) => raw || null;

  const renamedType = (formatConfigs[type]?.typeName ?? type) as DataType;
  const formattedData = formater(ndjsonHeader, converter(ndjsonHeader, data));

  const envelope = { type: renamedType, ...(nodeKey || nodekey ? { nodeKey: nodeKey ?? nodekey } : {}) };
  return formatConfigs[type]?.typeName
    ? { ...envelope, donnees: formattedData }
    : { ...envelope, data: formattedData };
};

export const getDiffObjLine = (
  dataRaw: DataLine,
  formatConfigs: FormatConfigs = {}
) => {
  if (!('datas' in dataRaw)) {
    return null;
  }

  const { datas, ...ndjsonHeader } = dataRaw as { datas: (RawEntity | null)[] } & NdjsonHeader;
  const [afterRaw, beforeRaw] = datas;
  const { event, type, nodeKey, nodekey }: NdjsonHeader & { nodeKey?: string } = ndjsonHeader;
  const converter = formatConfigs[type]?.converter ?? (type && rawToBan[type] ? rawToBan[type] : (_header: NdjsonHeader, raw: RawEntity) => raw);
  const formater = type && formatConfigs[type]?.formater
    ? formatConfigs[type].formater
    : (_ndjsonHeader: NdjsonHeader, raw: RawEntity) => raw || null;

  const renamedType = (formatConfigs[type]?.typeName ?? type) as DataType;
  const dataAfter = afterRaw == null ? null : formater(ndjsonHeader, converter(ndjsonHeader, afterRaw));
  const dataBefore = event === 'updated' && beforeRaw != null
    ? formater(ndjsonHeader, converter(ndjsonHeader, beforeRaw))
    : null;
  const excludedKeysOfCompare = formatConfigs[type]?.excludedKeysOfCompare ?? [];

  if (event === 'updated' && !isUnlike(dataBefore, dataAfter, excludedKeysOfCompare)) {
    return null;
  }

  const states = event === 'updated' ? [dataAfter, dataBefore] : [dataAfter];
  const envelope = { type: renamedType, ...(nodeKey || nodekey ? { nodeKey: nodeKey ?? nodekey } : {}) };
  return formatConfigs[type]?.typeName
    ? { ...envelope, evenement: event, donnees: states }
    : { ...envelope, event, data: states };
};
