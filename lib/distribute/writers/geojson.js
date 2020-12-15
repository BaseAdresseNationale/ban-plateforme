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

function prepareAdresse(numero, voie) {
  return point([numero.lon, numero.lat], {
    id: numero.cleInterop,
    numero: numero.numero,
    suffixe: numero.suffixe,
    nomVoie: voie.nomVoie,
    codeCommune: voie.codeCommune,
    nomCommune: voie.nomCommune,
    codeAncienneCommune: voie.codeAncienneCommune,
    nomAncienneCommune: voie.nomAncienneCommune,
    sourcePosition: numero.sourcePosition,
    sourceNomVoie: voie.sourceNomVoie
  })
}

function prepareToponyme(voie, type, position) {
  return feature(position, {
    id: voie.idVoie,
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
        const voie = voiesIndex[numero.idVoie]

        if (numero.position && numero.lon && numero.lat) {
          adressesStream.write(prepareAdresse(numero, voie))
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
