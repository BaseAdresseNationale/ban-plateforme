const {first, uniq, chain} = require('lodash')
const {CommunesDb} = require('../util/storage')
const consolidateVoies = require('./consolidate-voies')

const mergeDb = new CommunesDb('merge-default')
const compositionDb = new CommunesDb('composition-default')

async function processEntries(entries) {
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
  await compositionDb.setCommune(codeCommune, adressesCommune)
}

async function main(options) {
  const {codeCommune} = options
  console.time(`commune ${codeCommune}`)
  const adressesCommunes = await mergeDb.getCommune(codeCommune)

  if (!adressesCommunes) {
    return
  }

  const sources = uniq(adressesCommunes.map(a => a.source))
  if (sources.includes('bal')) {
    await processEntries(adressesCommunes.filter(a => a.source === 'bal'))
  } else {
    await processEntries(adressesCommunes.filter(a => a.source === 'cadastre' || (a.source.startsWith('ign-api-gestion') && a.source !== 'ign-api-gestion-dgfip')))
  }

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
