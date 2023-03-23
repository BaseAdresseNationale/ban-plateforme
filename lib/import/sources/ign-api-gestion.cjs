const {groupBy, chain} = require('lodash')
const {parseNumero} = require('../util.cjs')
const {readCsv} = require('../../util/csv.cjs')
const {createSourcePartUpdater} = require('../source-part-updater.cjs')

function parseCoords(str, precision) {
  const number = Number.parseFloat(str)
  const exp = 10 ** precision
  return Math.round(number * exp) / exp
}

const IGN_POSITION_TYPE_MAPPING = {
  postal: 'délivrance postale',
  entrance: 'entrée',
  building: 'bâtiment',
  staircase: 'cage d’escalier',
  unit: 'logement',
  parcel: 'parcelle',
  segment: 'segment',
  utility: 'service technique',
  area: 'segment'
}

function getPositionType(originalType) {
  if (originalType in IGN_POSITION_TYPE_MAPPING) {
    return IGN_POSITION_TYPE_MAPPING[originalType]
  }
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
    readCsv(sourcePartUpdater.getResourceData('hn-id-ign'), {delimiter: ';'}),
    readCsv(sourcePartUpdater.getResourceData('adresses'), {delimiter: ';'})
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
        suffixe: row.suffixe || undefined,
        nomVoie: row.nom_voie,
        lieuDitComplementNom: row.nom_complementaire || undefined,
        codePostal: row.code_postal,
        codeCommune: row.code_insee,
        nomCommune: row.nom_commune
      }

      if (row.id_ban_position) {
        adresse.idPosition = row.id_ban_position
        adresse.positionType = getPositionType(row.typ_loc)
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
