/* eslint unicorn/no-array-method-this-argument: off */
const {groupBy, difference} = require('lodash')
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

  const groupedAdresses = groupBy(adresses, 'codeCommune')

  await bluebird.map(Object.keys(groupedAdresses), async codeCommune => {
    const adressesCommune = groupedAdresses[codeCommune]
    await source(sourceName).updateAdresses(adressesCommune, {codeCommune, part})
  }, {concurrency: 8})

  // Delete previously covered communes not in part file anymore
  const previouslyCoveredCommunes = await source(sourceName).getCoveredCommunes(part)
  const removedCommunes = difference(previouslyCoveredCommunes, Object.keys(groupedAdresses))
  await bluebird.map(removedCommunes, async removedCommune => {
    await source(sourceName).removeAdresses(removedCommune)
  })
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
