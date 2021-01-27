const {Transform} = require('stream')
const communes = require('@etalab/decoupage-administratif/data/communes.json')
const {createGunzip} = require('gunzip-stream')
const {slugify} = require('@etalab/adresses-util')
const {chain, sortBy} = require('lodash')
const pumpify = require('pumpify')
const parse = require('csv-parser')
const getStream = require('get-stream')
const intoStream = require('into-stream')
const {createSourcePartUpdater} = require('../source-part-updater')

const codesCommunes = new Set(
  chain(communes).map('code').uniq().value()
)

function prepareData(item, enc, next) {
  const adresse = {
    dataSource: 'bal',
    source: 'bal',
    idAdresse: item.id,
    originalIdVoie: item.idVoie,
    numero: Number.parseInt(item.numero, 10),
    suffixe: item.suffixe || undefined,
    nomVoie: item.nomVoie,
    codeCommune: item.codeCommune,
    nomCommune: item.nomCommune
  }

  if (item.lon && item.lat) {
    const lon = parseFloat(item.lon)
    const lat = parseFloat(item.lat)

    if (lon !== 0 && lat !== 0) {
      adresse.position = {
        type: 'Point',
        coordinates: [lon, lat]
      }
    }
  }

  if (!codesCommunes.has(item.codeCommune)) {
    console.log(`Commune ${item.codeCommune} inconnu => adresse ignorée`)
    return next()
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

  return sortBy(adresses, a => {
    const positionId = a.position ? `${a.position.coordinates[0].toFixed(6)}/${a.position.coordinates[1].toFixed(6)}` : 'no-position'
    return `${a.codeCommune}-${slugify(a.nomVoie)}-${a.numero}${a.suffixe || ''}-${positionId}`
  })
}

module.exports = importData
