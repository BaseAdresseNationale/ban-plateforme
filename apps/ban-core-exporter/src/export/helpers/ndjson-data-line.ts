import { BAN_EXPORT_FORMAT } from '@ban/tools';

import { banStandardFormatters, toBanStandardEntity } from './ban-standard-formatters.js';
import { isUnlike } from './ndjson-data-line.helpers.js';
import type { DataLine, FormatConfigs, NdjsonHeader, RawEntity } from '../types.js';

const presentArray = (value: unknown) => Array.isArray(value) && value.length > 0 ? value : undefined;

export const getBanStandardStartLine = (exportType: string, params: Record<string, unknown>, dataTypes: string[]) => {
  const period = exportType === 'diff' ? { from: params.from, to: params.to } : { at: params.at };
  return JSON.stringify({ meta: {
    note: 'stream-start', formatVersion: '0.4', exportType, format: BAN_EXPORT_FORMAT,
    request: {
      dataTypes, departments: params.departements ?? [], ...period,
      ...(presentArray(params.address_ids) ? { addressIds: params.address_ids } : {}),
      ...(presentArray(params.common_toponym_ids) ? { toponymIds: params.common_toponym_ids } : {}),
      ...(presentArray(params.district_ids) ? { districtIds: params.district_ids } : {}),
    },
  } }) + '\n';
};

export const getBanStandardEndLine = (stats: Record<string, Record<string, number>>) => JSON.stringify({
  meta: { note: 'stream-end', generatedAt: new Date().toISOString(), stats },
}) + '\n';

export const getSnapshotObjLine = (
  dataRaw: DataLine,
  formatConfigs: FormatConfigs = banStandardFormatters
) => {
  if (!('data' in dataRaw)) return null;
  const { data, ...header } = dataRaw as { data: RawEntity } & NdjsonHeader;
  const { type, nodeKey, nodekey } = header;
  const converter = formatConfigs[type]?.converter ?? toBanStandardEntity;
  const formatter = formatConfigs[type]?.formater ?? ((_header: NdjsonHeader, value: RawEntity) => value);
  return { type, ...(nodeKey || nodekey ? { nodeKey: nodeKey ?? nodekey } : {}),
    data: formatter(header, converter(header, data)) };
};

export const getDiffObjLine = (
  dataRaw: DataLine,
  formatConfigs: FormatConfigs = banStandardFormatters
) => {
  if (!('datas' in dataRaw)) return null;
  const { datas, ...header } = dataRaw as { datas: (RawEntity | null)[] } & NdjsonHeader;
  const [afterRaw, beforeRaw] = datas;
  const { event, type, nodeKey, nodekey } = header;
  const converter = formatConfigs[type]?.converter ?? toBanStandardEntity;
  const formatter = formatConfigs[type]?.formater ?? ((_header: NdjsonHeader, value: RawEntity) => value);
  const after = afterRaw == null ? null : formatter(header, converter(header, afterRaw));
  const before = event === 'updated' && beforeRaw != null ? formatter(header, converter(header, beforeRaw)) : null;
  if (event === 'updated' && !isUnlike(before, after, formatConfigs[type]?.excludedKeysOfCompare ?? [])) return null;
  return { type, ...(nodeKey || nodekey ? { nodeKey: nodeKey ?? nodekey } : {}), event,
    data: event === 'updated' ? [after, before] : [after] };
};
