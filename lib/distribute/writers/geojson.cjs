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
const {prepareAdresse, prepareToponyme} = require('../../formatters/geojson.cjs')

function waitForDrain(stream) {
  if (stream.writableLength > stream.writableHighWaterMark) {
    return new Promise(resolve => {
      stream.once('drain', resolve)
    })
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

        if (numero.position) {
          adressesStream.write(prepareAdresse(numero, voie))
        }
      })

      voies.filter(v => v.position).forEach(v => {
        toponymesStream.write(prepareToponyme(v))
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
