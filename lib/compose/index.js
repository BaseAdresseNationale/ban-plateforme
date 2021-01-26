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

const locauxAdressesIndex = keyBy(communesLocauxAdresses, 'codeCommune')

const inputSources = [
  'ign-api-gestion',
  'cadastre',
  'ftth',
  'bal',
  'insee-ril'
]

async function buildLieuxDits(sourcesData, {codeCommune, pseudoCodeVoieGenerator}) {
  const balData = sourcesData.find(d => d.source === 'bal')
  const cadastreData = sourcesData.find(d => d.source === 'cadastre')

  if (balData && balData.adresses.length > 0) {
    if (balData.lieuxDits.some(ld => !ld.idVoie)) {
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

const MULTI_SOURCES = new Set([
  'cadastre',
  'ftth',
  'insee-ril',
  'ign-api-gestion-municipal_administration',
  'ign-api-gestion-sdis',
  'ign-api-gestion-ign',
  'ign-api-gestion-laposte'
])

function buildVoiesMultiSources(adresses, {codeCommune, pseudoCodeVoieGenerator}) {
  const filteredAdresses = adresses.filter(a => {
    // Suppression des adresses sans numéro
    if (!a.numero) {
      return false
    }

    const numero = Number.parseInt(a.numero, 10)

    // Suppression des numéros nuls
    if (numero === 0) {
      return false
    }

    // Suppression des numéros > 5000
    if (numero > 5000) {
      return false
    }

    // Suppression des lignes dont la source ne correspond pas
    if (!MULTI_SOURCES.has(a.source)) {
      return false
    }

    return true
  })

  if (filteredAdresses.length === 0) {
    return []
  }

  const adressesWithGroups = computeGroups(filteredAdresses)

  return consolidateVoies(adressesWithGroups, {pseudoCodeVoieGenerator, codeCommune})
}

function buildVoiesBAL(adresses, {codeCommune, pseudoCodeVoieGenerator}) {
  const adressesWithGroups = computeGroups(adresses)
  return consolidateVoies(adressesWithGroups, {pseudoCodeVoieGenerator, codeCommune})
}

async function buildVoies(sourcesData, {codeCommune, pseudoCodeVoieGenerator}) {
  const balData = sourcesData.find(d => d.source === 'bal')

  if (balData) {
    return buildVoiesBAL(
      balData.adresses,
      {codeCommune, pseudoCodeVoieGenerator}
    )
  }

  return buildVoiesMultiSources(
    flatten(sourcesData.map(d => d.adresses)),
    {codeCommune, pseudoCodeVoieGenerator}
  )
}

async function composeCommune(codeCommune) {
  const commune = getCommune(codeCommune)
  const pseudoCodeVoieGenerator = await createPseudoCodeVoieGenerator(codeCommune)

  if (!commune) {
    throw new Error(`La commune ${codeCommune} n’existe pas.`)
  }

  const sourcesData = await bluebird.mapSeries(inputSources, async sourceName => {
    const adressesCommune = await source(sourceName).getAdresses(codeCommune)
    const prepareData = require(`./sources/${sourceName}`)
    const data = await prepareData(adressesCommune, {codeCommune})
    return {...data, source: sourceName}
  })

  const composedVoies = await buildVoies(sourcesData, {codeCommune, pseudoCodeVoieGenerator})

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

  const lieuxDits = await buildLieuxDits(sourcesData, {codeCommune, pseudoCodeVoieGenerator})

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

  await pseudoCodeVoieGenerator.save()

  await saveCommuneData(codeCommune, {commune: communeRecord, voies: voiesToPersist, numeros})
}

module.exports = composeCommune
