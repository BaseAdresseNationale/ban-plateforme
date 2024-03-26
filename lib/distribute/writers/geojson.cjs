/* eslint camelcase: off */
const {createGzip} = require('zlib')
const {keyBy} = require('lodash')
const pumpify = require('pumpify')
const {stringify} = require('geojson-stream')
const {prepareAdresse, prepareToponyme} = require('../../formatters/geojson.cjs')
const {uploadFileToS3Stream} = require('../../util/s3.cjs')

function waitForDrain(stream) {
  if (stream.writableLength > stream.writableHighWaterMark) {
    return new Promise(resolve => {
      stream.once('drain', resolve)
    })
  }
}

async function createWriter(outputPath, departement) {
  const {writeStream: addressS3UploadWriteStream, uploadDonePromise: addressS3UploadDonePromise} = uploadFileToS3Stream(`${outputPath}/adresses-${departement}.geojson.gz`)
  const addressWriteStreamPipline = pumpify.obj(
    stringify(),
    createGzip()
  )
  addressWriteStreamPipline.pipe(addressS3UploadWriteStream)

  const {writeStream: toponymS3UploadWriteStream, uploadDonePromise: toponymS3UploadDonePromise} = uploadFileToS3Stream(`${outputPath}/toponymes-${departement}.geojson.gz`)
  const toponymWriteStreamPipeline = pumpify.obj(
    stringify(),
    createGzip(),
  )
  toponymWriteStreamPipeline.pipe(toponymS3UploadWriteStream)

  return {
    async writeAdresses({voies, numeros}) {
      const voiesIndex = keyBy(voies, 'idVoie')

      numeros.forEach(numero => {
        const voie = voiesIndex[numero.idVoie]

        if (numero.position) {
          addressWriteStreamPipline.write(prepareAdresse(numero, voie))
        }
      })

      voies.filter(v => v.position).forEach(v => {
        toponymWriteStreamPipeline.write(prepareToponyme(v))
      })

      await Promise.all([
        waitForDrain(addressWriteStreamPipline),
        waitForDrain(toponymWriteStreamPipeline)
      ])
    },

    async finish() {
      addressWriteStreamPipline.end()
      toponymWriteStreamPipeline.end()

      await Promise.all([
        addressS3UploadDonePromise,
        toponymS3UploadDonePromise
      ])
    }
  }
}

module.exports = {createWriter}
