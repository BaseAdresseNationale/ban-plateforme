/* eslint camelcase: off */
const {promisify} = require('util')
const {join} = require('path')
const {createWriteStream} = require('fs')
const {createGzip} = require('zlib')
const finished = promisify(require('stream').finished)
const {keyBy, chain} = require('lodash')
const {ensureDir} = require('fs-extra')
const pumpify = require('pumpify')
const {stringify} = require('geojson-stream')
const {center, feature, point, featureCollection} = require('@turf/turf')

function waitForDrain(stream) {
  if (stream.writableLength > stream.writableHighWaterMark) {
    return new Promise(resolve => stream.once('drain', resolve))
  }
}

function prepareAdresse(adresse) {
  return point([adresse.lon, adresse.lat], {
    id: adresse.cleInterop,
    numero: adresse.numero,
    suffixe: adresse.suffixe,
    nomVoie: adresse.nomVoie,
    codeCommune: adresse.codeCommune,
    nomCommune: adresse.nomCommune,
    codeAncienneCommune: adresse.codeAncienneCommune,
    nomAncienneCommune: adresse.nomAncienneCommune,
    sourcePosition: adresse.sourcePosition,
    sourceNomVoie: adresse.sourceNomVoie
  })
}

function prepareToponyme(voie, type, position) {
  return feature(position, {
    id: voie.cleInterop,
    type,
    nomVoie: voie.nomVoie,
    codeCommune: voie.codeCommune,
    nomCommune: voie.nomCommune,
    codeAncienneCommune: voie.codeAncienneCommune,
    nomAncienneCommune: voie.nomAncienneCommune,
    sourceNomVoie: voie.sourceNomVoie
  })
}

async function createWriter(outputPath, departement) {
  await ensureDir(outputPath)

  const adressesFile = createWriteStream(join(outputPath, `adresses-${departement}.geojson.gz`))
  const adressesStream = pumpify.obj(
    stringify(),
    createGzip(),
    adressesFile
  )

  const toponymesFile = createWriteStream(join(outputPath, `toponymes-${departement}.geojson.gz`))
  const toponymesStream = pumpify.obj(
    stringify(),
    createGzip(),
    toponymesFile
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
          adressesStream.write(prepareAdresse(adresse))
        }
      })

      chain(numeros)
        .filter(n => n.position)
        .groupBy('idVoie')
        .forEach((numerosVoie, idVoie) => {
          const voie = voiesIndex[idVoie]
          const position = center(featureCollection(numerosVoie.map(n => feature(n.position)))).geometry
          toponymesStream.write(prepareToponyme(voie, 'voie', position))
        })
        .value()

      voies.filter(v => v.type === 'lieu-dit' && v.position).forEach(v => {
        toponymesStream.write(prepareToponyme(v, 'lieu-dit', v.position))
      })

      await Promise.all([
        waitForDrain(adressesStream),
        waitForDrain(toponymesStream)
      ])
    },

    async finish() {
      adressesStream.end()
      toponymesStream.end()

      await Promise.all([
        finished(adressesFile),
        finished(toponymesFile)
      ])
    }
  }
}

module.exports = {createWriter}
