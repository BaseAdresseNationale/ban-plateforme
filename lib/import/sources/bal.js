const {Transform} = require('stream')
const {createGunzip} = require('gunzip-stream')
const pumpify = require('pumpify')
const parse = require('csv-parser')
const getStream = require('get-stream')
const intoStream = require('into-stream')
const {createSourcePartUpdater} = require('../source-part-updater')

function prepareData(item, enc, next) {
  const adresse = {
    dataSource: 'bal',
    source: 'bal',
    idAdresse: item.id,
    numero: item.numero,
    suffixe: item.suffixe,
    nomVoie: item.nomVoie,
    codeCommune: item.codeCommune,
    nomCommune: item.nomCommune
  }

  if (item.lon && item.lat) {
    adresse.position = {
      type: 'Point',
      coordinates: [parseFloat(item.lon), parseFloat(item.lat)]
    }
  }

  next(null, adresse)
}

async function importData(part) {
  const resourcesDefinition = [
    {
      name: 'adresses',
      url: `https://adresse.data.gouv.fr/data/adresses-locales/latest/csv/adresses-locales-${part}.csv.gz`
    }
  ]

  const sourcePartUpdater = createSourcePartUpdater('bal', part, resourcesDefinition, {allowNotFound: true})
  await sourcePartUpdater.update()

  if (!sourcePartUpdater.isResourceUpdated('adresses')) {
    return
  }

  const adresses = await getStream.array(pumpify.obj(
    intoStream(sourcePartUpdater.getResourceData('adresses')),
    createGunzip(),
    parse({separator: ';'}),
    new Transform({objectMode: true, transform: prepareData})
  ))

  await sourcePartUpdater.save()

  return adresses
}

module.exports = importData
