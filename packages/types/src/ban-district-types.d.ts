import type {
  BanDistrictID,
  DateISO8601,
  LangISO639v3,
  Meta,
  Config,
} from './ban-generic-types.js';

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
