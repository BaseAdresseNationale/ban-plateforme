const {Transform} = require('stream')
const {sortBy} = require('lodash')
const {createGunzip} = require('gunzip-stream')
const pumpify = require('pumpify')
const {parse} = require('geojson-stream')
const getStream = require('get-stream')
const intoStream = require('into-stream')
const iconv = require('iconv-lite')
const {createSourcePartUpdater} = require('../source-part-updater')

function prepareData(feature, enc, next) {
  const props = feature.properties

  if (!props.nomCommune) {
    return next()
  }

  const adresse = {
    dataSource: 'ftth',
    source: 'ftth',
    idAdresse: props.id,
    numero: props.numero,
    suffixe: props.suffixe,
    nomVoie: props.nomVoie,
    codeCommune: props.codeCommune,
    nomCommune: props.nomCommune,
    codePostal: props.codePostal || undefined,
    position: feature.geometry
  }

  next(null, adresse)
}

async function importData(part) {
  const resourcesDefinition = [
    {
      name: 'adresses',
      url: `https://adresse.data.gouv.fr/data/adresses-ftth/latest/geojson/adresses-ftth-${part}.geojson.gz`
    }
  ]

  const sourcePartUpdater = createSourcePartUpdater('ftth', part, resourcesDefinition, {allowNotFound: true})
  await sourcePartUpdater.update()

  if (!sourcePartUpdater.isResourceUpdated('adresses')) {
    return
  }

  const adresses = await getStream.array(pumpify.obj(
    intoStream(sourcePartUpdater.getResourceData('adresses')),
    createGunzip(),
    iconv.decodeStream('utf8'),
    parse(),
    new Transform({objectMode: true, transform: prepareData})
  ))

  await sourcePartUpdater.save()

  return sortBy(adresses, 'idAdresse')
}

module.exports = importData
