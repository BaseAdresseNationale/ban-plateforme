export {}

declare global {
  type RawEntity = Record<string, any>

  type RawDistrict = RawEntity

  type RawCommonToponym = RawEntity // FIXME: à typer correctement après avoir implémenté le endpoint getCommonToponym dans banAPI

  type DataType = 'district' | 'toponym' | 'address'
  type EventType = 'created' | 'disabled' | 'updated'

  interface NdjsonHeader {
    event?: EventType
    type: DataType
    nodekey: string
  }

  interface DiffLine extends NdjsonHeader {
    datas: (Record<string, unknown>)[] // Définir les type de District, CommonToponym, Address et les utiliser ici à la place de Record<string, unknown>
  }

  interface SnapshotLine extends NdjsonHeader {
    data: Record<string, unknown> // Définir les type de District, CommonToponym, Address et les utiliser ici à la place de Record<string, unknown>
  }

  type DataLine = DiffLine | SnapshotLine

  type Formatter = (ndjsonHeader: NdjsonHeader, raw: RawEntity) => Record<string, unknown>;

  interface FormatConfigs {
    [dataType: string]: {
      formater?: Formatter;
      typeName?: string;
      exclutedKeysForComparison?: string[];
    }
  }

  interface Formatters {
    [formatName: string]: FormatConfigs
  }

  type BanFormatter = (objLine: DataLine, converters?: FormatConfigs) => unknown;
}
