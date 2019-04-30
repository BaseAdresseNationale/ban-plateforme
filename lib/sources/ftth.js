const {createReadStream} = require('fs')
const {Transform} = require('stream')
const {pathExists} = require('fs-extra')
const {createGunzip} = require('gunzip-stream')
const pumpify = require('pumpify')
const {parse} = require('geojson-stream')
const getStream = require('get-stream')
const removeStacked = require('../processing/remove-stacked')
const recomputeCodesVoies = require('../processing/recompute-codes-voies')

function getRealCodeVoie(codeVoie) {
  if (codeVoie && !['X', 'Y', 'Z'].includes(codeVoie.charAt(0))) {
    return codeVoie
  }
}

function prepareData(feature, enc, next) {
  const props = feature.properties
  const adresse = {
    source: 'ftth',
    originalId: props.id,
    numero: props.numero,
    suffixe: props.suffixe,
    nomVoie: props.nomVoie,
    codeVoie: getRealCodeVoie(props.codeVoie),
    codeCommune: props.codeCommune,
    nomCommune: props.nomCommune,
    codePostal: props.codePostal || undefined,
    extras: {
      batiment: props.batiment,
      pseudoCodeVoie: props.pseudoCodeVoie
    },
    position: feature.geometry,
    licence: 'lov2'
  }
  next(null, adresse)
}

async function load(path) {
  if (!(await pathExists(path))) {
    return []
  }

  const adresses = await getStream.array(pumpify.obj(
    createReadStream(path),
    createGunzip(),
    parse(),
    new Transform({objectMode: true, transform: prepareData})
  ))
  await recomputeCodesVoies(adresses)
  return removeStacked(adresses, 'ftth')
}

module.exports = load
