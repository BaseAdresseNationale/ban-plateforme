const {Transform} = require('stream')
const {createGunzip} = require('gunzip-stream')
const pumpify = require('pumpify')
const {parse} = require('geojson-stream')
const getStream = require('get-stream')
const getAsStream = require('../../util/get-as-stream')
const {parseNumero} = require('../util')

function prepareData(feature, enc, next) {
  const props = feature.properties

  const adresse = {
    source: 'ftth',
    idAdresse: props.id,
    numero: parseNumero(props.numero),
    suffixe: props.suffixe,
    nomVoie: props.nomVoie,
    codeCommune: props.codeCommune,
    nomCommune: props.nomCommune,
    codePostal: props.codePostal || undefined,
    position: feature.geometry,
    licence: 'lov2'
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
    parse(),
    new Transform({objectMode: true, transform: prepareData})
  ))
  return adresses
}

module.exports = importData
