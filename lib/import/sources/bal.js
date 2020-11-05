const {Transform} = require('stream')
const {createGunzip} = require('gunzip-stream')
const pumpify = require('pumpify')
const parse = require('csv-parser')
const getStream = require('get-stream')
const getAsStream = require('../../util/get-as-stream')

function prepareData(item, enc, next) {
  const adresse = {
    dataSource: 'bal',
    source: 'bal',
    idAdresse: item.id,
    numero: item.numero,
    suffixe: item.suffixe,
    nomVoie: item.nomVoie,
    codeCommune: item.codeCommune,
    nomCommune: item.nomCommune,
    licence: item.licence
  }

  if (item.lon && item.lat) {
    adresse.position = {
      type: 'Point',
      coordinates: [parseFloat(item.lon), parseFloat(item.lat)]
    }
  }

  next(null, adresse)
}

async function importData(path) {
  const inputStream = await getAsStream(path)

  if (!inputStream) {
    return []
  }

  const adresses = await getStream.array(pumpify.obj(
    inputStream,
    createGunzip(),
    parse({separator: ';'}),
    new Transform({objectMode: true, transform: prepareData})
  ))
  return adresses
}

module.exports = importData
