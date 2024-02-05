/* eslint camelcase: off */
const {groupBy} = require('lodash')
const {harmlessProj} = require('../util/geo.cjs')
const {idsIdentifier} = require('../util/digest-ids-from-bal-uids.cjs')

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

function extractHeaders(csvRows) {
  const headers = new Set()

  for (const row of csvRows) {
    for (const header of Object.keys(row)) {
      headers.add(header)
    }
  }

  return [...headers]
}

function buildBalUIDAdresse(numero) {
  const {banId, banIdMainCommonToponym, banIdSecondaryCommonToponyms, banIdDistrict} = numero
  const banIDsFromNumero = {
    addressID: banId,
    mainTopoID: banIdMainCommonToponym,
    secondaryTopoIDs: banIdSecondaryCommonToponyms?.join('|'),
    districtID: banIdDistrict
  }
  return idsIdentifier.reduce((acc, {key, prefix}) => {
    if (banIDsFromNumero[key]) {
      return `${acc} ${prefix}${banIDsFromNumero[key]}`
    }

    return acc
  }, '')
}

function buildBalIDs(numero, version) {
  switch (version) {
    case '1.4':
      return {
        id_ban_commune: numero.banIdDistrict || '',
        id_ban_toponyme: numero.banIdMainCommonToponym || '',
        id_ban_adresse: numero.banId || '',
      }
    default:
      return {uid_adresse: buildBalUIDAdresse(numero)}
  }
}

function buildRow(voie, numero, position, {includesAlt = false, version = '1.3'}) {
  const row = {
    ...buildBalIDs(numero, version),
    cle_interop: numero.cleInterop,
    commune_insee: voie.codeCommune,
    commune_nom: voie.nomCommune,
    commune_deleguee_insee: numero.codeAncienneCommune || '',
    commune_deleguee_nom: numero.nomAncienneCommune || '',
    voie_nom: voie.nomVoie || '',
    lieudit_complement_nom: numero.lieuDitComplementNom || '',
    numero: Number.isInteger(numero.numero) ? numero.numero : '',
    suffixe: numero.suffixe || '',
    position: '',
    x: '',
    y: '',
    long: '',
    lat: '',
    cad_parcelles: numero.parcelles ? numero.parcelles.join('|') : '',
    source: getSource(numero.sourcePosition) || getSource(voie.sourceNomVoie) || '',
    date_der_maj: numero.dateMAJ || '',
    certification_commune: numero.certifie ? '1' : '0'
  }
  if (includesAlt) {
    if (voie.nomVoieAlt) {
      Object.keys(voie.nomVoieAlt).forEach(o => {
        row['voie_nom_' + o] = voie.nomVoieAlt[o]
      })
    }

    if (numero.lieuDitComplementNomAlt) {
      Object.keys(numero.lieuDitComplementNomAlt).forEach(o => {
        row['lieudit_complement_nom_' + o] = numero.lieuDitComplementNomAlt[o]
      })
    }
  }

  if (position) {
    const [lon, lat] = position.position.coordinates
    const [x, y] = harmlessProj([lon, lat])

    row.long = lon
    row.lat = lat
    row.x = x || ''
    row.y = y || ''
    row.position = position.positionType || ''
  }

  return row
}

function createFakeNumero(voie) {
  return {
    banIdMainCommonToponym: voie.banId,
    banIdDistrict: voie.banIdDistrict,
    cleInterop: voie.idVoie + '_99999',
    numero: 99_999,
    codeAncienneCommune: voie.codeAncienneCommune,
    nomAncienneCommune: voie.nomAncienneCommune,
    dateMAJ: voie.dateMAJ
  }
}

function prepareAdresses({voies, numeros}, {includesAlt, version} = {}) {
  const numerosIndex = groupBy(numeros, 'idVoie')
  const rows = []

  for (const voie of voies) {
    if (voie.type === 'lieu-dit') {
      const fakeNumero = createFakeNumero(voie)
      const position = voie.position ? {position: voie.position} : null
      rows.push(buildRow(voie, fakeNumero, position, {includesAlt, version}))
    } else if (voie.type === 'voie') {
      const numerosVoie = numerosIndex[voie.idVoie] || []
      for (const numero of numerosVoie) {
        for (const position of numero.positions) {
          rows.push(buildRow(voie, numero, position, {includesAlt, version}))
        }
      }
    }
  }

  return rows
}

module.exports = {prepareAdresses, extractHeaders}
