const {createReadStream} = require('fs')
const {pathExists} = require('fs-extra')
const {createGunzip} = require('gunzip-stream')
const pumpify = require('pumpify')
const parse = require('csv-parser')
const getStream = require('get-stream')
const {groupBy} = require('lodash')

async function readCsv(path) {
  if (!(await pathExists(path))) {
    return []
  }

  return getStream.array(pumpify.obj(
    createReadStream(path),
    createGunzip(),
    parse({separator: ';'})
  ))
}

function parseCoords(str, precision) {
  const number = Number.parseFloat(str)
  const exp = 10 ** precision
  return Math.round(number * exp) / exp
}

async function importData(pathPattern) {
  const [idIgnMappingRows, adressesRows] = await Promise.all([
    readCsv(pathPattern.replace('{name}', 'adresse_id_ign')),
    readCsv(pathPattern.replace('{name}', 'ban'))
  ])

  const idIgnMapping = groupBy(idIgnMappingRows, 'id_ban_adresse')

  return adressesRows.map(row => {
    const adresse = {
      source: 'ign-api-gestion',
      idAdresse: row.id_ban_adresse,
      anciensIdAdresse: row.id_ban_adresse in idIgnMapping ? idIgnMapping[row.id_ban_adresse].map(r => r.ign) : [],
      licence: 'lgr',
      numero: row.numero,
      suffixe: row.suffixe,
      nomVoie: row.nom_voie,
      codePostal: row.code_postal,
      codeCommune: row.code_insee,
      nomCommune: row.nom_commune,
      nomAncienneCommune: row.nom_complementaire
    }

    if (row.id_ban_position) {
      adresse.idPosition = row.id_ban_position
      adresse.typePosition = row.typ_loc
      adresse.sourcePosition = row.source
      adresse.dateMAJPosition = row.date_der_maj
      adresse.position = {
        type: 'Point',
        coordinates: [parseCoords(row.lon, 6), parseCoords(row.lat, 6)]
      }
    }

    return adresse
  })
}

module.exports = importData
