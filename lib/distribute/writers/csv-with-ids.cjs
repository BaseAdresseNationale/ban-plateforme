/* eslint camelcase: off */
const {promisify} = require('util')
const {join} = require('path')
const {createWriteStream} = require('fs')
const {createGzip} = require('zlib')
const finished = promisify(require('stream').finished)
const {ensureDir} = require('fs-extra')
const csvWriter = require('csv-write-stream')
const pumpify = require('pumpify')

const {prepareAdressesWithIds, prepareLieuxDitsWithIds} = require('../../formatters/csv-legacy.cjs')

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

  const adressesFile = createWriteStream(join(outputPath, `adresses-with-ids-${departement}.csv.gz`))
  const lieuxDitsFile = createWriteStream(join(outputPath, `lieux-dits-with-ids-${departement}-beta.csv.gz`))

  const adressesStream = createCsvWriteStream(adressesFile)
  const lieuxDitsStream = createCsvWriteStream(lieuxDitsFile)

  return {
    async writeAdresses({voies, numeros}) {
      prepareLieuxDitsWithIds({voies})
        .forEach(ld => lieuxDitsStream.write(ld))

      prepareAdressesWithIds({voies, numeros})
        .forEach(a => adressesStream.write(a))

      await Promise.all([
        waitForDrain(adressesStream),
        waitForDrain(lieuxDitsStream)
      ])
    },

    async finish() {
      adressesStream.end()
      lieuxDitsStream.end()

      await Promise.all([
        finished(adressesFile),
        finished(lieuxDitsFile)
      ])
    }
  }
}

module.exports = {createWriter}
