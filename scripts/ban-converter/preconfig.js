/* eslint-disable camelcase */

const ignHistoriqueAdressesConfig = {
  dataFormat: 'csv',
  fileExtention: 'csv',
  csvConfig: {
    delimiter: ';',
  },
  name: 'ign-historique-adresses',
  description: 'Export des adresses BAN vers le format IGN historique adresses',
  config: {
    id: 'meta.ban.DEPRECATED_id',
    id_fantoir: 'meta.dgfip.fantoir',
    numero: 'number',
    rep: 'suffix',
    nom_voie: '__microToponym.labels[0].value',
    code_postal: 'meta.laPoste.codePostal',
    code_insee: 'meta.insee.cog',
    nom_commune: '__district.Labels[0].value',
    code_insee_ancienne_commune: '', // ????? // Pas encore present dans le format BAN
    nom_ancienne_commune: '', // ????? // Pas encore present dans le format BAN
    x: '', // ????? meta.ban.positionX
    y: '', // ????? meta.ban.positionY
    lon: 'positions[0].geometry.coordinates[0]',
    lat: 'positions[0].geometry.coordinates[1]',
    type_position: 'positions[0].type',
    alias: null,
    nom_ld: 'labels[0].value',
    libelle_acheminement: 'meta.laPoste.libelleAcheminement',
    nom_afnor: ['NORMALIZE', '__microToponym.labels[0].value'],
    source_position: 'meta.ban.sourcePosition',
    source_nom_voie: '__microToponym.meta.ban.sourceNomVoie',
    certification_commune: ['NUMBER', 'certified'],
    cad_parcelles: ['ARRAY_JOIN', 'meta.dgfip.cadastre']
  }
}

const balConfig = {
  dataFormat: 'csv',
  fileExtention: 'csv',
  csvConfig: {
    delimiter: ';',
  },
  name: 'bal-1-4',
  description: 'Export des adresses BAN vers le format IGN historique adresses',
  config: {
    id_ban_commune: 'districtID',
    id_ban_toponyme: 'mainMicroToponymID',
    id_ban_adresse: 'id',
    cle_interop: 'meta.ban.DEPRECATED_cleInteropBAN',
    commune_insee: 'meta.insee.cog',
    commune_nom: '__district.Labels[0].value',
    commune_deleguee_insee: '', // ????? // Pas encore present dans le format BAN
    commune_deleguee_nom: '', // ????? // Pas encore present dans le format BAN
    voie_nom: '__microToponym.labels[0].value',
    lieudit_complement_nom: 'labels[0].value',
    numero: 'number',
    suffixe: 'suffix',
    position: 'positions[0].type',
    x: '', // ????? meta.ban.positionX
    y: '', // ????? meta.ban.positionY
    long: 'positions[0].geometry.coordinates[0]',
    lat: 'positions[0].geometry.coordinates[1]',
    cad_parcelle: 'meta.dgfip.cadastre',
    source: 'meta.ban.sourcePosition',
    date_der_maj: 'legalityDate',
    certification_commune: 'certified',
  }
}

const preconfig = {
  ign: ignHistoriqueAdressesConfig,
  bal: balConfig,
  'bal-1.4': balConfig,
}

export default preconfig
