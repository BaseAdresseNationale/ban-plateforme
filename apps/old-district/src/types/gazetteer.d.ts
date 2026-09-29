declare module '@ban-team/gazetteer' {
  type AdministrativeArea = {
    nom: string;
    code: string;
  };

  type GazetteerResult = {
    communeAncienne: AdministrativeArea;
    commune: AdministrativeArea;
    epci: AdministrativeArea;
    arrondissement: AdministrativeArea;
    departement: AdministrativeArea;
    region: AdministrativeArea;
  } | null;

  type Gazetteer = {
    find(coords: { lon: number; lat: number }): Promise<GazetteerResult>;
  };

  export function createGazetteer(options: {
    dbPath: string;
    cacheEnabled?: boolean;
    cacheSize?: number;
  }): Promise<Gazetteer>;
}
