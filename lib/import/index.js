const {chain} = require('lodash')
const bluebird = require('bluebird')
const source = require('../models/source')
const mongo = require('../util/mongo')

async function main({sourceName, part}) {
  await mongo.connect()
  const importData = require(`./sources/${sourceName}`)
  const adresses = await importData(part)

  if (!adresses) {
    return
  }

  const groupedAdresses = chain(adresses)
    .sortBy('idAdresse')
    .groupBy('codeCommune')
    .value()

  await bluebird.map(Object.keys(groupedAdresses), async codeCommune => {
    const adressesCommune = groupedAdresses[codeCommune]
    await source(sourceName).replaceAdresses(adressesCommune, {codeCommune, part})
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
