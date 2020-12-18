const {flatten, chain, omit, pick, keyBy} = require('lodash')
const bluebird = require('bluebird')
const {getCommune, getRegion, getDepartement} = require('../util/cog')
const source = require('../models/source')
const geo = require('../../geo.json')
const communesLocauxAdresses = require('../../data/communes-locaux-adresses.json')
const {saveCommuneData} = require('../models/commune')
const {createPseudoCodeVoieGenerator} = require('../pseudo-codes-voies')
const consolidateVoies = require('./consolidate-voies')
const computeGroups = require('./compute-groups')
const {filterAdresses} = require('./algorithm')

const locauxAdressesIndex = keyBy(communesLocauxAdresses, 'codeCommune')

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

async function buildLieuxDits(codeCommune, sourcesData) {
  const balData = sourcesData.find(d => d.source === 'bal')
  const cadastreData = sourcesData.find(d => d.source === 'cadastre')

  if (balData && balData.adresses.length > 0) {
    if (balData.lieuxDits.some(ld => !ld.idVoie)) {
      const pseudoCodeVoieGenerator = await createPseudoCodeVoieGenerator(codeCommune)
      balData.lieuxDits.filter(ld => !ld.idVoie).forEach(lieuDit => {
        const {nomVoie, codeAncienneCommune} = lieuDit
        const codeVoie = pseudoCodeVoieGenerator.getCode(nomVoie, codeAncienneCommune)
        lieuDit.idVoie = `${codeCommune}_${codeVoie}`
      })
      await pseudoCodeVoieGenerator.save()
    }

    return balData.lieuxDits
  }

  if (cadastreData) {
    return cadastreData.lieuxDits
  }

  return []
}

async function composeCommune(codeCommune) {
  const commune = getCommune(codeCommune)

  if (!commune) {
    throw new Error(`La commune ${codeCommune} n’existe pas.`)
  }

  const sourcesData = await bluebird.mapSeries(inputSources, async sourceName => {
    const adressesCommune = await source(sourceName).getAdresses(codeCommune)
    const prepareData = require(`./sources/${sourceName}`)
    const data = await prepareData(adressesCommune)
    return {...data, source: sourceName}
  })

  const flattenedAdresses = flatten(sourcesData.map(d => d.adresses)).filter(a => {
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

  const lieuxDits = await buildLieuxDits(codeCommune, sourcesData)

  const voiesToPersist = [...voies, ...lieuxDits]

  const nbNumeros = voies.reduce((acc, voie) => acc + voie.nbNumeros, 0)

  const communeRecord = {
    nomCommune: commune.nom,
    population: commune.population,
    departement: pick(getDepartement(commune.departement), 'nom', 'code'),
    region: pick(getRegion(commune.region), 'nom', 'code'),
    codesPostaux: commune.codesPostaux || [],
    displayBBox: geo[codeCommune].bbox,
    typeCommune: commune.type,
    nbNumeros,
    nbVoies: voies.length,
    nbLieuxDits: lieuxDits.length,
    typeComposition: voies.some(v => v.sourceNomVoie === 'bal') ? 'bal' : 'assemblage'
  }

  if (codeCommune in locauxAdressesIndex) {
    const nbAdressesAttendues = locauxAdressesIndex[codeCommune].nbAdressesLocaux
    const ratio = Math.round((nbNumeros / nbAdressesAttendues) * 100)
    const deficitAdresses = (commune.population < 2000 && commune.population > 0) ?
      ratio < 50 : undefined

    communeRecord.analyseAdressage = {
      nbAdressesAttendues,
      ratio,
      deficitAdresses
    }
  }

  await saveCommuneData(codeCommune, {commune: communeRecord, voies: voiesToPersist, numeros})
}

module.exports = composeCommune
