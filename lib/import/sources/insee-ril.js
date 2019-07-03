const {createReadStream} = require('fs')
const {Transform} = require('stream')
const {pathExists} = require('fs-extra')
const {createGunzip} = require('gunzip-stream')
const pumpify = require('pumpify')
const parse = require('csv-parser')
const getStream = require('get-stream')
const proj = require('proj4')
const wgs84 = require('epsg-index/s/4326.json').proj4

function prepareData(item, enc, next) {
  const adresse = {
    source: 'insee-ril',
    numero: item.numero,
    suffixe: item.repetition,
    nomVoie: [item.type_voie, item.libelle].filter(Boolean).join(' '),
    codeCommune: item.depcom,
    licence: 'lov2'
  }

  if (item.code_epsg && item.x && item.y) {
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
  if (!(await pathExists(path))) {
    return []
  }

  const adresses = await getStream.array(pumpify.obj(
    createReadStream(path),
    createGunzip(),
    parse({separator: ';'}),
    new Transform({objectMode: true, transform: prepareData})
  ))
  return adresses
}

module.exports = importData
