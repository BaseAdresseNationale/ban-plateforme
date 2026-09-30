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

export const getSnapshotObjLine = (
  dataRaw: DataLine,
  formatConfigs: FormatConfigs = {}
): DataLine | null => {
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

  return {
    type: renamedType,
    ...(nodeKey || nodekey ? { nodeKey: nodeKey ?? nodekey } : {}),
    data: formattedData,
  };
};

export const getDiffObjLine = (
  dataRaw: DataLine,
  formatConfigs: FormatConfigs = {}
): DataLine | null => {
  if (!('datas' in dataRaw)) {
    return null;
  }

  const { datas, ...ndjsonHeader } = dataRaw as { datas: RawEntity[] } & NdjsonHeader;
  const [afterRaw, beforeRaw] = datas;
  const { event, type, nodeKey, nodekey }: NdjsonHeader & { nodeKey?: string } = ndjsonHeader;
  const converter = formatConfigs[type]?.converter ?? (type && rawToBan[type] ? rawToBan[type] : () => (afterRaw || beforeRaw));
  const formater = type && formatConfigs[type]?.formater
    ? formatConfigs[type].formater
    : (_ndjsonHeader: NdjsonHeader, raw: RawEntity) => raw || null;

  const renamedType = (formatConfigs[type]?.typeName ?? type) as DataType;
  const dataAfter = formater(ndjsonHeader, converter(ndjsonHeader, afterRaw));
  const dataBefore = formater(ndjsonHeader, converter(ndjsonHeader, beforeRaw));
  const excludedKeysOfCompare = formatConfigs[type]?.excludedKeysOfCompare ?? [];

  if (event === 'updated' && !isUnlike(dataBefore, dataAfter, excludedKeysOfCompare)) {
    return null;
  }

  return {
    event,
    type: renamedType,
    ...(nodeKey || nodekey ? { nodeKey: nodeKey ?? nodekey } : {}),
    data: event === 'updated' ? [dataAfter, dataBefore] : [dataAfter],
  };
};
