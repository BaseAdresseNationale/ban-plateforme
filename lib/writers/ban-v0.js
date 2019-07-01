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
const {beautify} = require('@etalab/adresses-util')
const {findCodePostal} = require('codes-postaux/full')

function roundCoordinate(coordinate, precision = 6) {
  return parseFloat(coordinate.toFixed(precision))
}

function getCodePostal(codeCommune, idVoie, numero, suffixe) {
  if (idVoie.length === 10) {
    const [codeCommuneVoie, codeVoie] = idVoie.toUpperCase().split('_')
    return findCodePostal(codeCommuneVoie, codeVoie, numero, suffixe)
  }

  return findCodePostal(codeCommune)
}

function getIdFantoirField(codeCommune, idVoie) {
  if (idVoie.length === 10) {
    const [codeCommuneVoie, codeVoie] = idVoie.toUpperCase().split('_')
    return `${codeCommuneVoie}_${codeVoie}`
  }
}

function adresseToRow(a) {
  const projectedCoords = proj(a.position.coordinates)
  const codePostalResult = getCodePostal(a.codeCommune, a.idVoie, a.numero, a.suffixe)
  return {
    id: a.cleInterop,
    id_fantoir: getIdFantoirField(a.codeCommune, a.idVoie) || '',
    numero: a.numero,
    rep: a.suffixe,
    nom_voie: beautify(a.nomVoie),
    code_postal: codePostalResult ? codePostalResult.codePostal : '',
    code_insee: a.codeCommune,
    nom_commune: a.nomCommune,
    code_insee_ancienne_commune: a.codeAncienneCommune,
    nom_ancienne_commune: a.nomAncienneCommune,

    x: projectedCoords ? projectedCoords[0] : '',
    y: projectedCoords ? projectedCoords[1] : '',
    lon: roundCoordinate(a.position.coordinates[0]),
    lat: roundCoordinate(a.position.coordinates[1]),

    alias: '',
    nom_ld: '',
    libelle_acheminement: codePostalResult ? codePostalResult.libelleAcheminement : '',
    nom_afnor: normalize(a.nomVoie)
  }
}

async function writeData(path, adresses) {
  await ensureFile(path)
  const steps = [
    intoStream.object(adresses.filter(a => a.position).map(adresseToRow)),
    csvWriter({separator: ';'})
  ]
  if (path.endsWith('.gz')) {
    steps.push(createGzip())
  }

  steps.push(createWriteStream(path))
  await pipeline(...steps)
}

module.exports = writeData
