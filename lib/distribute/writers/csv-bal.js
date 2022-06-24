/* eslint camelcase: off */
const {promisify} = require('util')
const {join} = require('path')
const {createWriteStream} = require('fs')
const {createGzip} = require('zlib')
const finished = promisify(require('stream').finished)
const {ensureDir} = require('fs-extra')
const csvWriter = require('csv-write-stream')
const pumpify = require('pumpify')

const {prepareAdresses} = require('../../formatters/csv-bal')

function createCsvWriteStream(file) {
  return pumpify.obj(
    csvWriter({separator: ';'}),
    createGzip(),
    file
  )
}

function waitForDrain(stream) {
  if (stream.writableLength > stream.writableHighWaterMark) {
    return new Promise(resolve => {
      stream.once('drain', resolve)
    })
  }
}

async function createWriter(outputPath, departement) {
  await ensureDir(outputPath)

  const adressesFile = createWriteStream(join(outputPath, `adresses-${departement}.csv.gz`))
  const adressesStream = createCsvWriteStream(adressesFile)

  return {
    async writeAdresses({voies, numeros}) {
      prepareAdresses({voies, numeros})
        .forEach(a => adressesStream.write(a))

      await waitForDrain(adressesStream)
    },

    async finish() {
      adressesStream.end()
      await finished(adressesFile)
    }
  }
}

module.exports = {createWriter}
