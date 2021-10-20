const {flatten, chain, omit, pick, keyBy} = require('lodash')
const bluebird = require('bluebird')
const {getCommune: getCommuneCOG, getRegion, getDepartement} = require('../util/cog')
const source = require('../models/source')
const geo = require('../../geo.json')
const communesLocauxAdresses = require('../../data/communes-locaux-adresses.json')
const {getCommune, saveCommuneData} = require('../models/commune')
const {createPseudoCodeVoieGenerator} = require('../pseudo-codes-voies')
const consolidateVoies = require('./consolidate-voies')
const computeGroups = require('./processors/compute-groups')
const generateIds = require('./processors/generate-ids')

const locauxAdressesIndex = keyBy(communesLocauxAdresses, 'codeCommune')

const inputSources = [
  'ign-api-gestion',
  'cadastre',
  'ftth',
  'bal',
  'insee-ril'
]

async function buildLieuxDitsMS(sourcesData) {
  const cadastreData = sourcesData.find(d => d.source === 'cadastre')

  if (cadastreData) {
    return cadastreData.lieuxDits
  }

  return []
}

async function buildLieuxDitsBAL(balData, {codeCommune, pseudoCodeVoieGenerator}) {
  generateIds(balData.lieuxDits, {codeCommune, pseudoCodeVoieGenerator})
  return balData.lieuxDits
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

  const adressesWithGroups = computeGroups(filteredAdresses, true)

  return consolidateVoies(adressesWithGroups, {pseudoCodeVoieGenerator, codeCommune})
}

function buildVoiesBAL(adresses, {codeCommune, pseudoCodeVoieGenerator, forceCertification}) {
  const adressesWithGroups = computeGroups(adresses, false)
  return consolidateVoies(adressesWithGroups, {pseudoCodeVoieGenerator, codeCommune, forceCertification})
}

async function composeCommune(codeCommune) {
  const communeCOG = getCommuneCOG(codeCommune)
  const commune = await getCommune(codeCommune)

  const pseudoCodeVoieGenerator = await createPseudoCodeVoieGenerator(codeCommune)

  if (!communeCOG) {
    throw new Error(`La commune ${codeCommune} n’existe pas.`)
  }

  const sourcesData = await bluebird.mapSeries(inputSources, async sourceName => {
    const adressesCommune = await source(sourceName).getAdresses(codeCommune)
    const prepareData = require(`./sources/${sourceName}`)
    const data = await prepareData(adressesCommune, {codeCommune})
    return {...data, source: sourceName}
  })

  const balData = sourcesData.find(d => d.source === 'bal')
  const isBAL = balData && balData.adresses.length > 0

  const composeVoiesOptions = {
    codeCommune,
    pseudoCodeVoieGenerator,
    forceCertification: commune.forceCertification
  }

  const composedVoies = isBAL
    ? await buildVoiesBAL(balData.adresses, composeVoiesOptions)
    : await buildVoiesMultiSources(flatten(sourcesData.map(d => d.adresses)), composeVoiesOptions)

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

  const buildLieuxDitsOptions = {codeCommune, pseudoCodeVoieGenerator}

  const lieuxDits = isBAL
    ? await buildLieuxDitsBAL(balData, buildLieuxDitsOptions)
    : await buildLieuxDitsMS(sourcesData, buildLieuxDitsOptions)

  const voiesToPersist = [...voies, ...lieuxDits]

  const nbNumeros = voies.reduce((acc, voie) => acc + voie.nbNumeros, 0)
  const nbNumerosCertifies = numeros.filter(n => n.certifie).length

  const communeRecord = {
    nomCommune: communeCOG.nom,
    population: communeCOG.population,
    departement: pick(getDepartement(communeCOG.departement), 'nom', 'code'),
    region: pick(getRegion(communeCOG.region), 'nom', 'code'),
    codesPostaux: communeCOG.codesPostaux || [],
    displayBBox: geo[codeCommune].bbox,
    typeCommune: communeCOG.type,
    nbNumeros,
    nbNumerosCertifies,
    nbVoies: voies.length,
    nbLieuxDits: lieuxDits.length,
    typeComposition: voies.some(v => v.sourceNomVoie === 'bal') ? 'bal' : 'assemblage'
  }

  if (codeCommune in locauxAdressesIndex) {
    const nbAdressesAttendues = locauxAdressesIndex[codeCommune].nbAdressesLocaux
    const ratio = Math.round((nbNumeros / nbAdressesAttendues) * 100)
    const deficitAdresses = (communeCOG.population < 2000 && communeCOG.population > 0)
      ? ratio < 50 : undefined

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
