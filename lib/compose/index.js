const {chain, omit, pick, keyBy} = require('lodash')
const bluebird = require('bluebird')

const {getCommune: getCommuneCOG, getRegion, getDepartement} = require('../util/cog')

const geo = require('../../geo.json')
const communesLocauxAdresses = require('../../data/communes-locaux-adresses.json')

const {getCommune, saveCommuneData} = require('../models/commune')
const source = require('../models/source')

const {createPseudoCodeVoieGenerator} = require('../pseudo-codes-voies')
const MS = require('./strategies/multi-sources')
const BAL = require('./strategies/bal')

const locauxAdressesIndex = keyBy(communesLocauxAdresses, 'codeCommune')

async function getSourceData(sourceName, codeCommune) {
  const adresses = await source(sourceName).getAdresses(codeCommune)
  const prepareData = require(`./sources/${sourceName}`)
  return prepareData(adresses, {codeCommune})
}

async function getMultiSourcesData(codeCommune) {
  const multiSourcesInputs = [
    'ign-api-gestion',
    'cadastre',
    'ftth',
    'insee-ril'
  ]

  return bluebird.mapSeries(multiSourcesInputs, async sourceName => {
    const data = await getSourceData(sourceName, codeCommune)
    return {...data, source: sourceName}
  })
}

async function composeCommune(codeCommune) {
  const communeCOG = getCommuneCOG(codeCommune)
  const commune = await getCommune(codeCommune)

  if (!communeCOG) {
    throw new Error(`La commune ${codeCommune} n’existe pas.`)
  }

  const balData = await getSourceData('bal', codeCommune)
  const isBAL = balData.adresses.length > 0

  if (!isBAL && commune.typeComposition === 'bal') {
    console.log(`Composition des adresses de la commune ${codeCommune} abandonnée => régression vers assemblage interdite`)
    return
  }

  const multiSourcesData = !isBAL && await getMultiSourcesData(codeCommune)

  const pseudoCodeVoieGenerator = await createPseudoCodeVoieGenerator(codeCommune)

  const composeVoiesOptions = {
    codeCommune,
    pseudoCodeVoieGenerator,
    forceCertification: commune.forceCertification
  }

  const composedVoies = isBAL
    ? await BAL.buildVoies(balData, composeVoiesOptions)
    : await MS.buildVoies(multiSourcesData, composeVoiesOptions)

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

  const existingVoiesIds = new Set(chain(composedVoies).map('idVoie').uniq().value())
  const buildLieuxDitsOptions = {codeCommune, pseudoCodeVoieGenerator, existingVoiesIds}

  const lieuxDits = isBAL
    ? await BAL.buildLieuxDits(balData, buildLieuxDitsOptions)
    : await MS.buildLieuxDits(multiSourcesData, buildLieuxDitsOptions)

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
    typeComposition: isBAL ? 'bal' : 'assemblage'
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
