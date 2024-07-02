/* eslint camelcase: off */
const {createGzip} = require('zlib')
const csvWriter = require('csv-write-stream')
const pumpify = require('pumpify')

const {prepareAdresses, prepareLieuxDits} = require('../../formatters/csv-legacy.cjs')
const {uploadFileToS3Stream} = require('../../util/s3.cjs')

function createCsvGzipWriteStream() {
  return pumpify.obj(
    csvWriter({separator: ';'}),
    createGzip()
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
  const {writeStream: addressS3UploadWriteStream, uploadDonePromise: addressS3UploadDonePromise} = uploadFileToS3Stream(`${outputPath}/adresses-${departement}.csv.gz`)
  const {writeStream: lieuDitS3UploadWriteStream, uploadDonePromise: lieuDitS3UploadDonePromise} = uploadFileToS3Stream(`${outputPath}/lieux-dits-${departement}-beta.csv.gz`)

  const addressWriteStreamPipeline = createCsvGzipWriteStream()
  addressWriteStreamPipeline.pipe(addressS3UploadWriteStream)
  const lieuDitWriteStreamPipeline = createCsvGzipWriteStream()
  lieuDitWriteStreamPipeline.pipe(lieuDitS3UploadWriteStream)

  return {
    async writeAdresses({voies, numeros}) {
      prepareLieuxDits({voies})
        .forEach(ld => lieuDitWriteStreamPipeline.write(ld))

      prepareAdresses({voies, numeros})
        .forEach(a => addressWriteStreamPipeline.write(a))

      await Promise.all([
        waitForDrain(addressWriteStreamPipeline),
        waitForDrain(lieuDitWriteStreamPipeline)
      ])
    },

    async finish() {
      addressWriteStreamPipeline.end()
      lieuDitWriteStreamPipeline.end()

      await Promise.all([
        addressS3UploadDonePromise,
        lieuDitS3UploadDonePromise
      ])
    }
  }
}

module.exports = {createWriter}
