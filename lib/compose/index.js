const {first, chain} = require('lodash')
const {CommunesDb} = require('../util/storage')
const consolidateVoies = require('./consolidate-voies')

const mergeDb = new CommunesDb('merge-default')

async function processEntries(entries, output) {
  if (entries.length === 0) {
    return
  }

  const voies = await consolidateVoies(entries)
  const adressesCommune = chain(voies)
    .map(voie => voie.numeros.map(n => ({
      ...voie,
      ...n,
      numeros: undefined
    })))
    .flatten()
    .value()
  const {codeCommune} = first(adressesCommune)
  await output.setCommune(codeCommune, adressesCommune)
}

async function main(options) {
  const {codeCommune, productName} = options
  const output = new CommunesDb('composition-default')
  console.time(`commune ${codeCommune}`)
  const adressesCommune = await mergeDb.getCommune(codeCommune)

  if (!adressesCommune) {
    return
  }

  const {filterAdresses} = require(`./products/${productName}`)

  await processEntries(filterAdresses(adressesCommune), output)

  console.timeEnd(`commune ${codeCommune}`)
}

module.exports = async function (options, cb) {
  try {
    const result = await main(options)
    cb(null, result)
  } catch (error) {
    console.error(error)
    cb(error)
  }
}
