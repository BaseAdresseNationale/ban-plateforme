import { isUnlike } from "./ndjson-data-line.helpers.js";
import { rawToBan } from "./formatters.js";

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
  const formater = type && formatConfigs[type]?.formater 
    ? formatConfigs[type].formater 
    : (ndjsonHeader: NdjsonHeader, raw: RawEntity) => raw || null;

  const renamedType = (formatConfigs[type]?.typeName ?? type) as DataType;
  const formattedData = formater(ndjsonHeader, converter(ndjsonHeader, data));

  return {
    type: renamedType,
    nodekey,
    data: formattedData,
  }
}

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
  const excludedKeysOfCompare = formatConfigs[type]?.excludedKeysOfCompare ?? ([] as string[]);

  // Skip this line if before and after are similar for an 'updated' event.
  if (event === 'updated' && !isUnlike(dataBefore, dataAfter, excludedKeysOfCompare)) {
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
