const debug = require('debug')('adresse-pipeline')
const bluebird = require('bluebird')
const Adresse = require('../models/adresse')
const {getCodesCommunes} = require('../util/cog')
const mongo = require('../util/mongo')

async function main({departement, distName, outputPath}) {
  await mongo.connect()

  debug(`département ${departement}`)
  const {createWriter} = require(`./writers/${distName}`)
  const writer = await createWriter(outputPath, departement)

  await bluebird.map(getCodesCommunes(departement), async codeCommune => {
    const adresses = await Adresse.getAllByCommune(codeCommune)
    writer.writeAdresses(adresses)
  }, {concurrency: 4})

  await writer.finish()
}

module.exports = async function (options, cb) {
  try {
    await main(options)
    cb()
  } catch (error) {
    console.error(error)
    cb(error)
  }
}
