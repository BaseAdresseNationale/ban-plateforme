import type {
  BanAddressID,
  BanCommonTopoID,
  BanDistrictID,
  DistrictInseeID,
  PositionType,
  DateISO8601,
  LangISO639v3,
} from './ban-generic-types.js';

export type UIdAdresse = string;
type CommuneNomIsoCodeKey = `commune_nom_${LangISO639v3}`;

type CommuneDelegueeNomIsoCodeKey = `commune_deleguee_nom_${LangISO639v3}`;
type VoieNomIsoCodeKey = `voie_nom_${LangISO639v3}`;
type LieuditComplementNomIsoCodeKey = `lieudit_complement_nom_${LangISO639v3}`;
export type MultilingualBalKey = VoieNomIsoCodeKey | LieuditComplementNomIsoCodeKey | CommuneNomIsoCodeKey | CommuneDelegueeNomIsoCodeKey

export type BalVersion = '1.3' | '1.4';

export type BalAdresse = {
  uid_adresse?: UIdAdresse;
  id_ban_commune?: BanAddressID;
  id_ban_toponyme?: BanCommonTopoID;
  id_ban_adresse?: BanDistrictID;
  cle_interop: string;
  commune_insee: DistrictInseeID;
  commune_nom: string;
  commune_deleguee_insee?: string;
  commune_deleguee_nom?: string;
  voie_nom: string;
  lieudit_complement_nom?: string;
  numero?: number;
  suffixe?: string;
  position: PositionType;
  x: number;
  y: number;
  long: number;
  lat: number;
  cad_parcelles?: string[];
  source: string;
  date_der_maj: DateISO8601;
  certification_commune: boolean;
  [key: MultilingualBalKey]: string;
};

export type Bal = BalAdresse[];
