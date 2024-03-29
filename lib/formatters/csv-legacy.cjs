/* eslint camelcase: off */
const {keyBy} = require('lodash')
const normalize = require('@etalab/normadresse')

function getIdFantoirField(codeCommune, idVoie) {
  if (idVoie.length === 10) {
    const [codeCommuneVoie, codeVoie] = idVoie.toUpperCase().split('_')
    return `${codeCommuneVoie}_${codeVoie}`
  }
}

const SOURCES_MAPPING = {
  bal: 'commune',
  'ign-api-gestion-municipal_administration': 'commune',
  'ign-api-gestion-laposte': 'laposte',
  'ign-api-gestion-sdis': 'sdis',
  'ign-api-gestion-ign': 'inconnue',
  cadastre: 'cadastre',
  ftth: 'arcep'
}

function getSource(rawSource) {
  if (rawSource in SOURCES_MAPPING) {
    return SOURCES_MAPPING[rawSource]
  }
}

function adresseToRow(a) {
  return {
    id: a.cleInterop,
    id_fantoir: getIdFantoirField(a.codeCommune, a.idVoie) || '',
    numero: a.numero,
    rep: a.suffixe || '',
    nom_voie: a.nomVoie,
    code_postal: a.codePostal || '',
    code_insee: a.codeCommune,
    nom_commune: a.nomCommune,
    code_insee_ancienne_commune: a.codeAncienneCommune || '',
    nom_ancienne_commune: a.nomAncienneCommune || '',

    x: a.x || '',
    y: a.y || '',
    lon: a.lon || '',
    lat: a.lat || '',
    type_position: a.positionType || '',

    alias: '',
    nom_ld: a.lieuDitComplementNom,
    libelle_acheminement: a.libelleAcheminement || '',
    nom_afnor: normalize(a.nomVoie),

    source_position: getSource(a.sourcePosition) || '',
    source_nom_voie: getSource(a.sourceNomVoie) || '',

    certification_commune: a.certifie ? '1' : '0',
    cad_parcelles: a.parcelles ? a.parcelles.join('|') : ''
  }
}

function adresseToRowWithIds(a) {
  return {
    id: a.cleInterop,
    id_fantoir: getIdFantoirField(a.codeCommune, a.idVoie) || '',
    numero: a.numero,
    rep: a.suffixe || '',
    nom_voie: a.nomVoie,
    code_postal: a.codePostal || '',
    code_insee: a.codeCommune,
    nom_commune: a.nomCommune,
    code_insee_ancienne_commune: a.codeAncienneCommune || '',
    nom_ancienne_commune: a.nomAncienneCommune || '',

    x: a.x || '',
    y: a.y || '',
    lon: a.lon || '',
    lat: a.lat || '',
    type_position: a.positionType || '',

    alias: '',
    nom_ld: a.lieuDitComplementNom,
    libelle_acheminement: a.libelleAcheminement || '',
    nom_afnor: normalize(a.nomVoie),

    source_position: getSource(a.sourcePosition) || '',
    source_nom_voie: getSource(a.sourceNomVoie) || '',

    certification_commune: a.certifie ? '1' : '0',
    cad_parcelles: a.parcelles ? a.parcelles.join('|') : '',
    id_ban_adresse: a.banId || '',
    id_ban_toponyme: a.banIdMainCommonToponym || '',
    id_ban_commune: a.banIdDistrict || '',
  }
}

function lieuDitToRowWithIds(a) {
  return {
    id: a.idVoie,
    nom_lieu_dit: a.nomVoie,
    code_postal: a.codePostal || '',
    code_insee: a.codeCommune,
    nom_commune: a.nomCommune,
    code_insee_ancienne_commune: a.codeAncienneCommune || '',
    nom_ancienne_commune: a.nomAncienneCommune || '',

    x: a.x || '',
    y: a.y || '',
    lon: a.lon || '',
    lat: a.lat || '',

    source_position: a.source,
    source_nom_voie: a.source,
    id_ban_toponyme: a.banId || '',
    id_ban_commune: a.banIdDistrict || ''
  }
}

function lieuDitToRow(a) {
  return {
    id: a.idVoie,
    nom_lieu_dit: a.nomVoie,
    code_postal: a.codePostal || '',
    code_insee: a.codeCommune,
    nom_commune: a.nomCommune,
    code_insee_ancienne_commune: a.codeAncienneCommune || '',
    nom_ancienne_commune: a.nomAncienneCommune || '',

    x: a.x || '',
    y: a.y || '',
    lon: a.lon || '',
    lat: a.lat || '',

    source_position: a.source,
    source_nom_voie: a.source
  }
}

function prepareAdresses({voies, numeros}) {
  const voiesIndex = keyBy(voies, 'idVoie')

  return numeros
    .filter(n => n.position && n.lon && n.lat)
    .map(n => {
      const voie = voiesIndex[n.idVoie]

      if (!voie) {
        throw new Error(`Voie ${n.idVoie} introuvable`)
      }

      return adresseToRow({...voie, ...n})
    })
}

function prepareAdressesWithIds({voies, numeros}) {
  const voiesIndex = keyBy(voies, 'idVoie')

  return numeros
    .filter(n => n.position && n.lon && n.lat)
    .map(n => {
      const voie = voiesIndex[n.idVoie]

      if (!voie) {
        throw new Error(`Voie ${n.idVoie} introuvable`)
      }

      return adresseToRowWithIds({...voie, ...n})
    })
}

function prepareLieuxDits({voies}) {
  return voies.filter(v => v.type === 'lieu-dit').map(v => lieuDitToRow(v))
}

function prepareLieuxDitsWithIds({voies}) {
  return voies.filter(v => v.type === 'lieu-dit').map(v => lieuDitToRowWithIds(v))
}

module.exports = {prepareAdresses, prepareLieuxDits, prepareLieuxDitsWithIds, prepareAdressesWithIds}
