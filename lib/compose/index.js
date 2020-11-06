const bluebird = require('bluebird')
const {chain, flatten} = require('lodash')
const SourceAdresse = require('../models/source-adresse')
const Adresse = require('../models/adresse')
const mongo = require('../util/mongo')
const consolidateVoies = require('./consolidate-voies')
const extractLieuxDits = require('./extract-lieux-dits')
const computeGroups = require('./compute-groups')
const {filterAdresses} = require('./algorithm')

async function readSourceData(sourceName, codeCommune) {
  const adressesCommune = await SourceAdresse.getAllByContext({dataSource: sourceName, codeCommune})
  return require(`./sources/${sourceName}`)(adressesCommune)
}

const inputSources = [
  'ign-api-gestion',
  'cadastre',
  'ftth',
  'bal',
  'insee-ril'
]

const filterSources = [
  'ign-api-gestion-ign',
  'ign-api-gestion-laposte',
  'ign-api-gestion-sdis',
  'ign-api-gestion-municipal_administration',
  'cadastre',
  'ftth',
  'bal',
  'insee-ril'
]

async function buildAdresses(rawAdressesCommune) {
  const filteredAdresses = filterAdresses(rawAdressesCommune)

  if (filteredAdresses.length === 0) {
    return []
  }

  const voies = await consolidateVoies(filteredAdresses)

  return chain(voies)
    .map(voie => voie.numeros.map(n => ({
      ...voie,
      ...n,
      numeros: undefined
    })))
    .flatten()
    .value()
}

async function main(options) {
  await mongo.connect()
  const {codeCommune} = options

  console.time(`commune ${codeCommune}`)

  const communeStats = {codeCommune, sources: {}}

  const sourcesAdresses = await bluebird.mapSeries(inputSources, async s => {
    const {adresses, stats} = await readSourceData(s, codeCommune)
    communeStats.sources[s] = stats
    return adresses
  })

  const flattenedAdresses = flatten(sourcesAdresses).filter(a => {
    // Suppression des adresses sans numéro
    if (!a.numero) {
      return false
    }

    // Suppression des numéros nuls
    if (Number.parseInt(a.numero, 10) === 0) {
      return false
    }

    // Suppression des lignes dont la source ne correspond pas
    if (filterSources && !filterSources.includes(a.source)) {
      return false
    }

    return true
  })

  if (flattenedAdresses.length === 0) {
    return communeStats
  }

  const rawAdressesCommune = computeGroups(flattenedAdresses)

  const adresses = await buildAdresses(rawAdressesCommune)
  const lieuxDits = extractLieuxDits(rawAdressesCommune)

  await Adresse.overrideAllByCommune(codeCommune, [...adresses, ...lieuxDits])

  console.timeEnd(`commune ${codeCommune}`)

  return communeStats
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
