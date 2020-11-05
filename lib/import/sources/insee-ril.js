const {Transform} = require('stream')
const {createGunzip} = require('gunzip-stream')
const pumpify = require('pumpify')
const parse = require('csv-parser')
const getStream = require('get-stream')
const proj = require('proj4')
const wgs84 = require('epsg-index/s/4326.json').proj4
const {parseNumero} = require('../util')
const getAsStream = require('../../util/get-as-stream')

function prepareData(item, enc, next) {
  // Check we have 26 columns
  if (Object.keys(item).length !== 26) {
    return next()
  }

  const adresse = {
    dataSource: 'insee-ril',
    source: 'insee-ril',
    numero: parseNumero(item.numero),
    suffixe: item.repetition,
    nomVoie: [item.type_voie, item.libelle].filter(Boolean).join(' '),
    codeCommune: item.depcom,
    licence: 'lov2'
  }

  if (item.code_epsg && [4, 5].includes(item.code_epsg.length) && item.x && item.y) {
    const projDefinition = require(`epsg-index/s/${item.code_epsg}.json`).proj4
    const coords = [parseFloat(item.x), parseFloat(item.y)]

    adresse.position = {
      type: 'Point',
      coordinates: proj(projDefinition, wgs84, coords)
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
