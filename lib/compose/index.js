const {flatten, chain, omit} = require('lodash')
const bluebird = require('bluebird')
const {getCommune} = require('../util/cog')
const source = require('../models/source')
const {saveCommuneData} = require('../models/commune')
const consolidateVoies = require('./consolidate-voies')
const extractLieuxDits = require('./extract-lieux-dits')
const computeGroups = require('./compute-groups')
const {filterAdresses} = require('./algorithm')

async function readSourceData(sourceName, codeCommune) {
  const adressesCommune = await source(sourceName).getAdresses(codeCommune)
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

async function buildVoies(rawAdressesCommune) {
  const filteredAdresses = filterAdresses(rawAdressesCommune)

  if (filteredAdresses.length === 0) {
    return []
  }

  return consolidateVoies(filteredAdresses)
}

async function composeCommune(codeCommune) {
  const sourcesAdresses = await bluebird.mapSeries(inputSources, async s => {
    const {adresses} = await readSourceData(s, codeCommune)
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
    return {adresses: [], lieuxDits: []}
  }

  const rawAdressesCommune = computeGroups(flattenedAdresses)
  const composedVoies = await buildVoies(rawAdressesCommune)

  const voies = composedVoies.map(v => ({
    type: 'voie',
    ...omit(v, 'numeros')
  }))

  const numeros = chain(composedVoies)
    .map(v => v.numeros.map(n => ({
      codeCommune,
      idVoie: v.idVoie,
      ...n
    })))
    .flatten()
    .value()

  const lieuxDits = extractLieuxDits(rawAdressesCommune)
  const voiesToPersist = [...voies, ...lieuxDits]

  const commune = getCommune(codeCommune)

  const communeRecord = {
    nomCommune: commune.nom,
    population: commune.population,
    departement: commune.departement,
    region: commune.region,
    typeCommune: commune.type,
    nbNumeros: voies.reduce((acc, voie) => acc + voie.nbNumeros, 0),
    nbVoies: voies.length,
    nbLieuxDits: lieuxDits.length,
    typeComposition: voies.some(v => v.sourceNomVoie === 'bal') ? 'bal' : 'assemblage'
  }

  await saveCommuneData(codeCommune, {commune: communeRecord, voies: voiesToPersist, numeros})
}

module.exports = composeCommune
