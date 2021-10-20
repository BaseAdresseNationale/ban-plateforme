const {flatten, chain, omit, pick, keyBy} = require('lodash')
const bluebird = require('bluebird')

const {getCommune: getCommuneCOG, getRegion, getDepartement} = require('../util/cog')

const geo = require('../../geo.json')
const communesLocauxAdresses = require('../../data/communes-locaux-adresses.json')

const {getCommune, saveCommuneData} = require('../models/commune')
const source = require('../models/source')

const {createPseudoCodeVoieGenerator} = require('../pseudo-codes-voies')
const {buildVoiesMS, buildLieuxDitsMS} = require('./strategies/multi-sources')
const {buildVoiesBAL, buildLieuxDitsBAL} = require('./strategies/bal')

const locauxAdressesIndex = keyBy(communesLocauxAdresses, 'codeCommune')

const inputSources = [
  'ign-api-gestion',
  'cadastre',
  'ftth',
  'bal',
  'insee-ril'
]

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
    : await buildVoiesMS(flatten(sourcesData.map(d => d.adresses)), composeVoiesOptions)

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
