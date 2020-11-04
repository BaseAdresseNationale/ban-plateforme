/* eslint camelcase: off */
const {promisify} = require('util')
const {join} = require('path')
const {createWriteStream} = require('fs')
const {createGzip} = require('zlib')
const finished = promisify(require('stream').finished)
const {ensureDir} = require('fs-extra')
const pumpify = require('pumpify')
const {stringify} = require('ndjson')

async function createWriter(outputPath, departement) {
  await ensureDir(outputPath)

  const adressesFile = createWriteStream(join(outputPath, `adresses-${departement}.ndjson.gz`))
  const adressesStream = pumpify.obj(
    stringify(),
    createGzip(),
    adressesFile
  )
  let adressesStreamAcceptsWrite = true

  return {
    async writeAdresses(adresses) {
      adresses.forEach(adresse => {
        if (adresse.position && adresse.lon && adresse.lat) {
          adressesStreamAcceptsWrite = adressesStream.write(adresse)
        }
      })

      if (!adressesStreamAcceptsWrite) {
        await new Promise(resolve => adressesStream.once('drain', resolve))
      }
    },

    async finish() {
      adressesStream.end()
      await finished(adressesFile)
    }
  }
}

module.exports = {createWriter}
