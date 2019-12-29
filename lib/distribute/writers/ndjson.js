/* eslint camelcase: off */
const {promisify} = require('util')
const {join} = require('path')
const {createWriteStream} = require('fs')
const {createGzip} = require('zlib')
const pipeline = promisify(require('stream').pipeline)
const {ensureFile} = require('fs-extra')
const intoStream = require('into-stream')
const {stringify} = require('ndjson')

async function writeAdresses(filePath, adresses) {
  await ensureFile(filePath)

  await pipeline(
    intoStream.object(adresses.filter(a => a.position && a.lon && a.lat)),
    stringify({separator: ';'}),
    createGzip(),
    createWriteStream(filePath)
  )
}

async function writeData({outputPath, departement, adresses}) {
  await writeAdresses(join(outputPath, `adresses-${departement}.ndjson.gz`), adresses)
}

module.exports = {writeData}
