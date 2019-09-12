const {chain} = require('lodash')
const {CommunesDb} = require('../util/storage')
const consolidateVoies = require('./consolidate-voies')

async function main(options) {
  const {codeCommune, productName} = options
  const {filterAdresses, selectNomVoie, selectPosition} = require(`./products/${productName}`)

  const mergeStorage = new CommunesDb('merge-default')
  const compositionStorage = new CommunesDb(`composition-${productName}`)
  console.time(`commune ${codeCommune}`)

  const rawAdressesCommune = (await mergeStorage.getCommune(codeCommune)) || []

  const filteredAdresses = filterAdresses(rawAdressesCommune)

  if (filteredAdresses.length === 0) {
    return
  }

  const voies = await consolidateVoies(filteredAdresses, {selectNomVoie, selectPosition})

  const adressesCommune = chain(voies)
    .map(voie => voie.numeros.map(n => ({
      ...voie,
      ...n,
      numeros: undefined
    })))
    .flatten()
    .value()

  await compositionStorage.setCommune(codeCommune, adressesCommune)

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
