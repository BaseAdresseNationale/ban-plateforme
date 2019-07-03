const {groupBy} = require('lodash')
const bluebird = require('bluebird')
const {SourceDb} = require('../util/storage')

async function main({sourceName, sourcePath}) {
  const importData = require(`./sources/${sourceName}`)
  const adresses = await importData(sourcePath)
  const db = new SourceDb(sourceName)
  const groupedAdresses = groupBy(adresses, 'codeCommune')

  await bluebird.map(Object.keys(groupedAdresses), async codeCommune => {
    const adressesCommune = groupedAdresses[codeCommune]
    await db.setCommune(codeCommune, adressesCommune)
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
