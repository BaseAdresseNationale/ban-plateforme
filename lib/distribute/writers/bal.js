/* eslint camelcase: off */
const {promisify} = require('util')
const {createWriteStream} = require('fs')
const {createGzip} = require('zlib')
const pipeline = promisify(require('stream').pipeline)
const {ensureFile} = require('fs-extra')
const intoStream = require('into-stream')
const csvWriter = require('csv-write-stream')
const proj = require('@etalab/project-legal')

function roundCoordinate(coordinate, precision = 6) {
  return parseFloat(coordinate.toFixed(precision))
}

function adresseToRow(a) {
  const projectedCoords = proj(a.position.coordinates)
  return {
    cle_interop: a.cleInterop,
    numero: a.numero,
    suffixe: a.suffixe,
    voie_nom: a.nomVoie,
    commune_nom: a.nomCommune,
    commune_code: a.codeCommune,
    ancienne_commune_nom: a.nomAncienneCommune || '',
    ancienne_commune_code: a.codeAncienneCommune || '',
    source: a.sources.join(','),
    long: roundCoordinate(a.position.coordinates[0]),
    lat: roundCoordinate(a.position.coordinates[1]),
    x: projectedCoords ? projectedCoords[0] : '',
    y: projectedCoords ? projectedCoords[1] : ''
  }
}

async function writeData(path, adresses) {
  await ensureFile(path)
  const steps = [
    intoStream.object(adresses.filter(a => a.position && !a.pseudoNumero).map(adresseToRow)),
    csvWriter({separator: ';'})
  ]
  if (path.endsWith('.gz')) {
    steps.push(createGzip())
  }

  steps.push(createWriteStream(path))
  await pipeline(...steps)
}

module.exports = {writeData}
