/* eslint camelcase: off */
const {createGzip} = require('zlib')
const csvWriter = require('csv-write-stream')
const pumpify = require('pumpify')

const {prepareAdresses} = require('../../formatters/csv-bal.cjs')
const {uploadFileToS3Stream} = require('../../util/s3.cjs')

function createCsvGzipWriteStream() {
  return pumpify.obj(
    csvWriter({separator: ';'}),
    createGzip(),
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
  const {writeStream: s3UploadWriteStream, uploadDonePromise: s3UploadDonePromise} = uploadFileToS3Stream(`${outputPath}/adresses-${departement}.csv.gz`)
  const addressWriteStreamPipeline = createCsvGzipWriteStream()
  addressWriteStreamPipeline.pipe(s3UploadWriteStream)

  return {
    async writeAdresses({voies, numeros}) {
      prepareAdresses({voies, numeros}, {})
        .forEach(a => addressWriteStreamPipeline.write(a))

      await waitForDrain(addressWriteStreamPipeline)
    },

    async finish() {
      addressWriteStreamPipeline.end()
      await s3UploadDonePromise
    }
  }
}

module.exports = {createWriter}
