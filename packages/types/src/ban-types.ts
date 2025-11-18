import type {
  BanAddressID,
  BanCommonTopoID,
  BanDistrictID,
  PositionType,
  DateISO8601,
  LangISO639v3,
  Geometry,
  Meta,
  Config,
} from './ban-generic-types.js';

// TODO: use english names ?

export type Position = {
  type: PositionType;
  geometry: Geometry;
};

export type Label = {
  isoCode: LangISO639v3; // code ISO de la langue
  value: string; // nom de la voie
};

export type BanDistrict = {
  id: BanDistrictID; // code INSEE de la commune
  labels: {
    isoCode: LangISO639v3; // code ISO de la langue
    value: string; // nom de la voie
  }[];
  updateDate: DateISO8601; // date de mise à jour de la commune
  meta?: Meta;
  config?: Config;
};

export type BanDistricts = BanDistrict[];

export type BanCommonToponym = {
  id: BanCommonTopoID; // identifiant unique de la voie
  districtID: BanDistrictID; // code INSEE de la commune
  labels: Label[];
  geometry?: Geometry;
  updateDate: DateISO8601; // date de mise à jour de la voie
  meta?: Meta;
};

export type BanCommonToponyms = BanCommonToponym[];

export type BanAddress = {
  id: BanAddressID; // identifiant unique de l'adresse
  districtID: BanDistrictID; // code INSEE de la commune
  mainCommonToponymID: BanCommonTopoID; // identifiant unique du toponyme principal
  secondaryCommonToponymIDs?: BanCommonTopoID[]; // identifiant unique des toponymes secondaires
  number: number; // numéro de l'adresse
  suffix?: string;
  labels?: Label[];
  positions: Position[]; // positions géographiques de l'adresse
  certified?: boolean;
  updateDate: DateISO8601; // date de mise à jour de l'adresse
  meta?: Meta;
};

export type BanAddresses = BanAddress[];

export type Ban = {
  districtID: BanDistrictID; // code INSEE de la commune
  commonToponyms: Record<BanCommonTopoID, BanCommonToponym>; // voies, lieux-dits, etc.
  addresses: Record<BanAddressID, BanAddress>; // adresses
};
