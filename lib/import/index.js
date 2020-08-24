const {groupBy} = require('lodash')
const bluebird = require('bluebird')
const SourceAdresse = require('../models/source-adresse')
const mongo = require('../util/mongo')

async function main({sourceName, sourcePath}) {
  await mongo.connect()
  const importData = require(`./sources/${sourceName}`)
  const adresses = await importData(sourcePath)
  const groupedAdresses = groupBy(adresses, 'codeCommune')

  await bluebird.map(Object.keys(groupedAdresses), async codeCommune => {
    const adressesCommune = groupedAdresses[codeCommune]
    await SourceAdresse.overrideAllByContext({source: sourceName, codeCommune}, adressesCommune)
  }, {concurrency: 8})
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
