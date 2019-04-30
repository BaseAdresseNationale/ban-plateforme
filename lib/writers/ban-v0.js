/* eslint camelcase: off */
const {promisify} = require('util')
const {createWriteStream} = require('fs')
const {createGzip} = require('zlib')
const pipeline = promisify(require('stream').pipeline)
const {ensureFile} = require('fs-extra')
const intoStream = require('into-stream')
const csvWriter = require('csv-write-stream')
const proj = require('@etalab/project-legal')
const normalize = require('@etalab/normadresse')
const {findCodePostal} = require('codes-postaux/full')
const {buildCleInterop} = require('@etalab/adresses-util/lib/bal')

function roundCoordinate(coordinate, precision = 6) {
  return parseFloat(coordinate.toFixed(precision))
}

function adresseToRow(a) {
  const projectedCoords = proj(a.position.coordinates)
  const codePostalResult = findCodePostal(a.codeCommune, a.codeVoie, a.numero, a.repetition)
  return {
    id: buildCleInterop(a),
    nom_voie: a.nomVoie,
    id_fantoir: a.codeVoie,
    numero: a.numero,
    rep: a.suffixe,
    code_insee: a.codeCommune,
    code_postal: codePostalResult ? codePostalResult.codePostal : '',
    alias: '',
    nom_ld: '',
    nom_afnor: normalize(a.nomVoie),
    libelle_acheminement: codePostalResult ? codePostalResult.libelleAcheminement : '',
    x: projectedCoords ? projectedCoords[0] : '',
    y: projectedCoords ? projectedCoords[1] : '',
    lon: roundCoordinate(a.position.coordinates[0]),
    lat: roundCoordinate(a.position.coordinates[1]),
    nom_commune: a.nomCommune
  }
}

async function writeData(path, adresses) {
  await ensureFile(path)
  const steps = [
    intoStream.obj(adresses.map(adresseToRow)),
    csvWriter({separator: ';'})
  ]
  if (path.endsWith('.gz')) {
    steps.push(createGzip())
  }

  steps.push(createWriteStream(path))
  await pipeline(...steps)
}

module.exports = writeData
