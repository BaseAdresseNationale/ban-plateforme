const {createGunzip} = require('gunzip-stream')
const pumpify = require('pumpify')
const Papa = require('papaparse')
const getStream = require('get-stream')
const {groupBy, chain} = require('lodash')
const intoStream = require('into-stream')
const {parseNumero} = require('../util')
const {createSourcePartUpdater} = require('../source-part-updater')

async function readCsv(buffer) {
  return getStream.array(pumpify.obj(
    intoStream(buffer),
    createGunzip(),
    Papa.parse(Papa.NODE_STREAM_INPUT, {delimiter: ';'})
  ))
}

function parseCoords(str, precision) {
  const number = Number.parseFloat(str)
  const exp = 10 ** precision
  return Math.round(number * exp) / exp
}

async function importData(part) {
  const resourcesDefinition = [
    {
      name: 'adresses',
      url: `https://adresse.data.gouv.fr/data/ban/export-api-gestion/latest/ban/ban-${part}.csv.gz`
    },
    {
      name: 'hn-id-ign',
      url: `https://adresse.data.gouv.fr/data/ban/export-api-gestion/latest/housenumber-id-ign/housenumber-id-ign-${part}.csv.gz`
    }
  ]

  const sourcePartUpdater = createSourcePartUpdater('ign-api-gestion', part, resourcesDefinition, {allowNotFound: true})
  await sourcePartUpdater.update()

  if (!sourcePartUpdater.isResourceUpdated('adresses')) {
    return
  }

  const [idIgnMappingRows, adressesRows] = await Promise.all([
    readCsv(sourcePartUpdater.getResourceData('hn-id-ign')),
    readCsv(sourcePartUpdater.getResourceData('adresses'))
  ])

  const idIgnMapping = groupBy(idIgnMappingRows, 'id_ban_adresse')

  const adresses = chain(adressesRows)
    .map(row => {
      const adresse = {
        dataSource: 'ign-api-gestion',
        source: row.source ? 'ign-api-gestion-' + row.source : 'ign-api-gestion-no-source',
        idAdresse: row.id_ban_adresse,
        anciensIdAdresse: row.id_ban_adresse in idIgnMapping ? idIgnMapping[row.id_ban_adresse].map(r => r.ign).sort() : [],
        numero: parseNumero(row.numero),
        suffixe: row.suffixe,
        nomVoie: row.nom_voie,
        codePostal: row.code_postal,
        codeCommune: row.code_insee,
        nomCommune: row.nom_commune
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
    .sortBy('idPosition')
    .value()

  await sourcePartUpdater.save()

  return adresses
}

module.exports = importData
