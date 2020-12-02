/* eslint camelcase: off */
const {promisify} = require('util')
const {join} = require('path')
const {createWriteStream} = require('fs')
const {createGzip} = require('zlib')
const finished = promisify(require('stream').finished)
const {keyBy} = require('lodash')
const {ensureDir} = require('fs-extra')
const pumpify = require('pumpify')
const {stringify} = require('geojson-stream')

function waitForDrain(stream) {
  if (stream.writableLength > stream.writableHighWaterMark) {
    return new Promise(resolve => stream.once('drain', resolve))
  }
}

function prepareFeature(adresse) {
  return {
    type: 'Feature',
    id: adresse.cleInterop,
    properties: {
      numero: adresse.numero,
      suffixe: adresse.suffixe,
      nomVoie: adresse.nomVoie,
      codeCommune: adresse.codeCommune,
      nomCommune: adresse.nomCommune,
      codeAncienneCommune: adresse.codeAncienneCommune,
      nomAncienneCommune: adresse.nomAncienneCommune,
      sourcePosition: adresse.sourcePosition,
      sourceNomVoie: adresse.sourceNomVoie
    },
    geometry: {
      type: 'Point',
      coordinates: [adresse.lon, adresse.lat]
    }
  }
}

async function createWriter(outputPath, departement) {
  await ensureDir(outputPath)

  const adressesFile = createWriteStream(join(outputPath, `adresses-${departement}.geojson.gz`))
  const adressesStream = pumpify.obj(
    stringify(),
    createGzip(),
    adressesFile
  )

  return {
    async writeAdresses({voies, numeros}) {
      const voiesIndex = keyBy(voies, 'idVoie')

      numeros.forEach(numero => {
        const adresse = {
          ...voiesIndex[numero.idVoie],
          ...numero
        }

        if (adresse.position && adresse.lon && adresse.lat) {
          adressesStream.write(prepareFeature(adresse))
        }
      })

      await waitForDrain(adressesStream)
    },

    async finish() {
      adressesStream.end()
      await finished(adressesFile)
    }
  }
}

module.exports = {createWriter}
