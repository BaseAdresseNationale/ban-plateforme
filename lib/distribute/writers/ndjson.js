/* eslint camelcase: off */
const {promisify} = require('util')
const {join} = require('path')
const {createWriteStream} = require('fs')
const {createGzip} = require('zlib')
const finished = promisify(require('stream').finished)
const {ensureDir} = require('fs-extra')
const pumpify = require('pumpify')
const {stringify} = require('ndjson')

function waitForDrain(stream) {
  if (stream.writableLength > stream.writableHighWaterMark) {
    return new Promise(resolve => stream.once('drain', resolve))
  }
}

async function createWriter(outputPath, departement) {
  await ensureDir(outputPath)

  const adressesFile = createWriteStream(join(outputPath, `adresses-${departement}.ndjson.gz`))
  const adressesStream = pumpify.obj(
    stringify(),
    createGzip(),
    adressesFile
  )

  return {
    async writeAdresses(adresses) {
      adresses.forEach(adresse => {
        if (adresse.position && adresse.lon && adresse.lat) {
          adressesStream.write(adresse)
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
