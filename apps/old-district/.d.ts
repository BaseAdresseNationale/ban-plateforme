type GazetteerResult = {
    communeAncienne: { nom: string; code: string };
    commune: { nom: string; code: string };
    epci: { nom: string; code: string };
    arrondissement: { nom: string; code: string };
    departement: { nom: string; code: string };
    region: { nom: string; code: string };
} | null;

type GazetteerFind = (coords: { lon: number; lat: number }) => Promise<GazetteerResult>;

type Gazetteer = {
    find: GazetteerFind;
};

declare module '@ban-team/gazetteer' {
    export function createGazetteer(options: any): Promise<Gazetteer>;
}