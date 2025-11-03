export type BanAddressID = string;
export type BanCommonTopoID = string;
export type BanDistrictID = string;
export type DistrictInseeID = string;
export type PositionType =
  | 'entrée'
  | 'parcelle'
  | 'voie'
  | 'lieu-dit'
  | 'commune'
  | 'ancienne-entrée'
  | 'ancienne-parcelle'
  | 'ancienne-voie'
  | 'ancien-lieu-dit'
  | 'ancienne-commune'
  | 'autre'; // TODO: update with more possible values OR Comply with the defined BAL Standard : https://aitf-sig-topo.github.io/voies-adresses/files/AITF_SIG_Topo_Format_Base_Adresse_Locale_v1.3.pdf
export type DateISO8601 = Date;
export type LangISO639v3 = string;
export type Meta = {
  [key: string]: any;
};
export type Config = {
  certificate?: boolean;
  defaultBalLang: LangISO639v3;
};
export type GeometryType = 'Point'; // TODO: add other types
export type Geometry = {
  type: GeometryType;
  coordinates: [number, number, number?];
};
