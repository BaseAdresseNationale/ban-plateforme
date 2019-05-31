const {groupBy} = require('lodash')
const bluebird = require('bluebird')
const {SourceDb} = require('./db')

async function main({departement, sourceName, sourcePath}) {
  console.log(departement)
  const importData = require(`../sources/${sourceName}/import`)
  const adresses = await importData(sourcePath)
  const db = new SourceDb(sourceName)
  const groupedAdresses = groupBy(adresses, 'codeCommune')

  await Promise.all(Object.keys(groupedAdresses).map(async codeCommune => {
    const adressesCommune = groupedAdresses[codeCommune]
    await db.setCommune(codeCommune, adressesCommune)
  }))

  await bluebird.map(Object.keys(groupedAdresses), async codeCommune => {
    const adressesCommune = groupedAdresses[codeCommune]
    await db.setCommune(codeCommune, adressesCommune)
  }, {concurrency: 4})
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
