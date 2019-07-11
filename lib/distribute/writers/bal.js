/* eslint camelcase: off */
const {promisify} = require('util')
const {createWriteStream} = require('fs')
const {createGzip} = require('zlib')
const pipeline = promisify(require('stream').pipeline)
const {ensureFile} = require('fs-extra')
const intoStream = require('into-stream')
const csvWriter = require('csv-write-stream')

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
    long: a.lon || '',
    lat: a.lat || '',
    x: a.x || '',
    y: a.y || ''
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
