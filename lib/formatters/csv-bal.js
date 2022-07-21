/* eslint camelcase: off */
const {groupBy} = require('lodash')
const {beautify} = require('@etalab/adresses-util')
const {harmlessProj} = require('../util/geo')

const SOURCES_MAPPING = {
  bal: 'commune',
  'ign-api-gestion-municipal_administration': 'commune',
  'ign-api-gestion-laposte': 'laposte',
  'ign-api-gestion-sdis': 'sdis',
  'ign-api-gestion-ign': 'inconnue',
  cadastre: 'cadastre',
  ftth: 'arcep',
  'insee-ril': 'insee'
}

function getSource(rawSource) {
  if (rawSource in SOURCES_MAPPING) {
    return SOURCES_MAPPING[rawSource]
  }
}

function beautifyOrEmpty(string) {
  return string ? beautify(string) : ''
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

function buildRow(voie, numero, position, includesAlt = false) {
  const row = {
    uid_adresse: '',
    cle_interop: numero.cleInterop,
    commune_insee: voie.codeCommune,
    commune_nom: voie.nomCommune,
    commune_deleguee_insee: numero.codeAncienneCommune || '',
    commune_deleguee_nom: numero.nomAncienneCommune || '',
    voie_nom: beautifyOrEmpty(voie.nomVoie),
    lieudit_complement_nom: beautifyOrEmpty(numero.lieuDitComplementNom),
    numero: Number.isInteger(numero.numero) ? numero.numero : '',
    suffixe: numero.suffixe || '',
    position: '',
    x: '',
    y: '',
    long: '',
    lat: '',
    cad_parcelles: numero.parcelles ? numero.parcelles.join('|') : '',
    source: getSource(numero.sourcePosition) || getSource(voie.sourceNomVoie) || '',
    date_der_maj: '',
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
    cleInterop: voie.idVoie + '_99999',
    numero: 99_999,
    codeAncienneCommune: voie.codeAncienneCommune,
    nomAncienneCommune: voie.nomAncienneCommune
  }
}

function prepareAdresses({voies, numeros}, includesAlt) {
  const numerosIndex = groupBy(numeros, 'idVoie')
  const rows = []

  for (const voie of voies) {
    const numerosVoie = numerosIndex[voie.idVoie]
    const fakeNumero = createFakeNumero(voie)
    const positionsVoie = voie.positions || []

    if (!numerosVoie && positionsVoie.length === 0) {
      rows.push(buildRow(voie, fakeNumero, null, includesAlt))
    } else {
      for (const position of positionsVoie) {
        rows.push(buildRow(voie, fakeNumero, position, includesAlt))
      }

      for (const numero of numerosVoie) {
        for (const position of numero.positions) {
          rows.push(buildRow(voie, numero, position, includesAlt))
        }
      }
    }
  }

  return rows
}

module.exports = {prepareAdresses, extractHeaders}
