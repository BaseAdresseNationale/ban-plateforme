export type DataExportType = 'ban' | 'diff';
export type DataType = 'district' | 'toponym' | 'address';
export type EventType = 'created' | 'disabled' | 'updated';
export type RawEntity = Record<string, any>;
export type RawDistrict = RawEntity;
export type RawCommonToponym = RawEntity;

export type DataExportParams = {
  format: string;
  dataTypes: string[];
  departements: string[];
  address_ids: string[] | null;
  common_toponym_ids: string[] | null;
  district_ids: string[] | null;
  at?: string | null;
  from?: string | null;
  to?: string | null;
};

export type DataExportRequestMessage = {
  token: string;
  exportType: DataExportType;
  params: DataExportParams;
};

export interface NdjsonHeader {
  event?: EventType;
  type: DataType;
  nodekey: string;
}

export interface DiffLine extends NdjsonHeader {
  datas: Record<string, unknown>[];
}

export interface SnapshotLine extends NdjsonHeader {
  data: Record<string, unknown>;
}

export type DataLine = DiffLine | SnapshotLine;

export type Formatter = (ndjsonHeader: NdjsonHeader, raw: RawEntity) => Record<string, unknown>;

export interface FormatConfigs {
  [dataType: string]: {
    formater?: Formatter;
    typeName?: string;
    excludedKeysOfCompare?: string[];
  };
}

export interface Formatters {
  [formatName: string]: FormatConfigs;
}

export type BanFormatter = (objLine: DataLine, converters?: FormatConfigs) => unknown;

export type ExportRequestConfig = {
  dataName: string;
  request: string;
  params: string[];
};

export type ExportRequestConfigs = Record<DataType, ExportRequestConfig>;

export type ExportFileResult = {
  filePath: string;
  stats: Record<string, unknown>;
};
