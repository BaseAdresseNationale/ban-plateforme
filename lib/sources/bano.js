const {createReadStream} = require('fs')
const {Transform} = require('stream')
const {createGunzip} = require('gunzip-stream')
const pumpify = require('pumpify')
const parse = require('csv-parser')
const getStream = require('get-stream')
const {extractNumeroSuffixe} = require('@etalab/adresses-util/lib/numeros')
const recomputeCodesVoies = require('../processing/recompute-codes-voies')

function prepareData(addr, enc, next) {
  const {numero, suffixe} = extractNumeroSuffixe(addr.numero)
  const codeCommune = addr.id.substr(0, 5)

  const adresse = {
    source: 'bano',
    originalId: addr.id,
    numero,
    suffixe,
    nomVoie: addr.voie,
    codeCommune,
    nomCommune: addr.nom_comm,
    codePostal: addr.code_post || undefined,
    extras: {
      source: addr.source
    },
    position: {
      type: 'Point',
      coordinates: [parseFloat(addr.lon), parseFloat(addr.lat)]
    },
    licence: 'odc-odbl'
  }

  next(null, adresse)
}

const COLUMNS = [
  'id',
  'numero',
  'voie',
  'code_post',
  'nom_comm',
  'source',
  'lat',
  'lon'
]

async function load(path) {
  const adresses = await getStream.array(pumpify.obj(
    createReadStream(path),
    createGunzip(),
    parse({separator: ',', headers: COLUMNS}),
    new Transform({objectMode: true, transform: prepareData})
  ))
  await recomputeCodesVoies(adresses)
  return adresses
}

module.exports = load
