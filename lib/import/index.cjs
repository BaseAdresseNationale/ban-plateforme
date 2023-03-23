/* eslint unicorn/no-array-method-this-argument: off */
const {groupBy, difference} = require('lodash')
const bluebird = require('bluebird')
const source = require('../models/source.cjs')
const mongo = require('../util/mongo.cjs')
const {codeCommuneExists} = require('../util/cog.cjs')

async function main({sourceName, part}) {
  console.log(`${part} => démarrage de l'import des données`)
  await mongo.connect()
  const importData = require(`./sources/${sourceName}.cjs`)
  const adresses = await importData(part)

  if (!adresses) {
    console.log(`${part} => pas de données ou données inchangées`)
    return
  }

  const groupedAdresses = groupBy(adresses, 'codeCommune')

  await bluebird.map(Object.keys(groupedAdresses), async codeCommune => {
    if (!codeCommuneExists(codeCommune)) {
      console.log(`${codeCommune} => commune inconnue => adresses ignorées`)
      return
    }

    const adressesCommune = groupedAdresses[codeCommune]
    await source(sourceName).updateAdresses(adressesCommune, {codeCommune, part})

    console.log(`${codeCommune} => données de la commune importées`)
  }, {concurrency: 8})

  // Delete previously covered communes not in part file anymore
  const previouslyCoveredCommunes = await source(sourceName).getCoveredCommunes(part)
  const removedCommunes = difference(previouslyCoveredCommunes, Object.keys(groupedAdresses))
  await bluebird.map(removedCommunes, async removedCommune => {
    await source(sourceName).removeAdresses(removedCommune)
    console.log(`${removedCommune} => suppression des données de la commune (plus présente)`)
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
