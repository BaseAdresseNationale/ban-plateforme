/* eslint camelcase: off */
const {createGzip} = require('zlib')
const csvWriter = require('csv-write-stream')
const pumpify = require('pumpify')

const {prepareAdressesWithIds, prepareLieuxDitsWithIds} = require('../../formatters/csv-legacy.cjs')
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
  const {writeStream: addressS3UploadWriteStream, uploadDonePromise: addressS3UploadDonePromise} = uploadFileToS3Stream(`${outputPath}/adresses-with-ids-${departement}.csv.gz`)
  const {writeStream: lieuDitS3UploadWriteStream, uploadDonePromise: lieuDitS3UploadDonePromise} = uploadFileToS3Stream(`${outputPath}/lieux-dits-with-ids-${departement}-beta.csv.gz`)

  const addressWriteStreamPipeline = createCsvGzipWriteStream(addressS3UploadWriteStream)
  addressWriteStreamPipeline.pipe(addressS3UploadWriteStream)
  const lieuDitWriteStreamPipeline = createCsvGzipWriteStream(lieuDitS3UploadWriteStream)
  lieuDitWriteStreamPipeline.pipe(lieuDitS3UploadWriteStream)

  return {
    async writeAdresses({voies, numeros}) {
      prepareLieuxDitsWithIds({voies})
        .forEach(ld => lieuDitWriteStreamPipeline.write(ld))

      prepareAdressesWithIds({voies, numeros})
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
