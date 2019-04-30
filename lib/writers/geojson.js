const {promisify} = require('util')
const {createWriteStream} = require('fs')
const {createGzip} = require('zlib')
const pipeline = promisify(require('stream').pipeline)
const {ensureFile} = require('fs-extra')
const intoStream = require('into-stream')
const {stringify} = require('JSONStream')
const {pick} = require('lodash')

const GEOJSON_OPEN = '{"type":"FeatureCollection","features":[\n'
const GEOJSON_CLOSE = '\n]}\n'
const GEOJSON_SEPARATOR = '\n,\n'

function adresseToFeature(a) {
  return {
    type: 'Feature',
    properties: pick(a, 'numero', 'suffixe', 'codeVoie', 'nomVoie', 'codeCommune', 'nomCommune', 'sources', 'positionSource', 'positionType', 'id'),
    geometry: a.position
  }
}

async function writeData(path, adresses) {
  await ensureFile(path)
  const steps = [
    intoStream.obj(adresses.map(adresseToFeature)),
    stringify(GEOJSON_OPEN, GEOJSON_SEPARATOR, GEOJSON_CLOSE)
  ]
  if (path.endsWith('.gz')) {
    steps.push(createGzip())
  }

  steps.push(createWriteStream(path))
  await pipeline(...steps)
}

module.exports = writeData
