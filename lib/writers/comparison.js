/* eslint camelcase: off */
const {promisify} = require('util')
const {createWriteStream} = require('fs')
const {createGzip} = require('zlib')
const pipeline = promisify(require('stream').pipeline)
const {ensureFile} = require('fs-extra')
const intoStream = require('into-stream')
const csvWriter = require('csv-write-stream')

function roundCoordinate(coordinate, precision = 6) {
  return parseFloat(coordinate.toFixed(precision))
}

function getComparaison({suffixe, sources, numero}) {
  if (sources.length === 1 && sources[0] === 'ban-v0') {
    return suffixe ? 'ban-v0-only-suffixe' : 'ban-v0-only'
  }

  const parsedNumero = Number.parseInt(numero, 10)
  if (parsedNumero > 5000) {
    return 'pseudo-adresse'
  }

  if (!sources.includes('ban-v0')) {
    return 'ban-lo-only'
  }

  return 'both'
}

function adresseToRow(a) {
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
    lon: roundCoordinate(a.position.coordinates[0]),
    lat: roundCoordinate(a.position.coordinates[1]),
    comparison: getComparaison(a)
  }
}

async function writeData(path, adresses) {
  await ensureFile(path)
  const steps = [
    intoStream.object(adresses.filter(a => a.position && !a.pseudoNumero).map(adresseToRow)),
    csvWriter({separator: ','})
  ]
  if (path.endsWith('.gz')) {
    steps.push(createGzip())
  }

  steps.push(createWriteStream(path))
  await pipeline(...steps)
}

module.exports = writeData
