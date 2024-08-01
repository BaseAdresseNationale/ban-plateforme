/* eslint-disable complexity */
const {chain, omit, pick, keyBy} = require('lodash')
const bluebird = require('bluebird')
const {v4: uuidv4} = require('uuid')

const {getCommune: getCommuneCOG, getRegion, getDepartement} = require('../util/cog.cjs')

const geo = require('../../geo.json')

const {getCommune, saveCommuneData} = require('../models/commune.cjs')
const source = require('../models/source.cjs')

const {createPseudoCodeVoieGenerator} = require('../pseudo-codes-voies.cjs')
const {getCurrentRevision} = require('../util/api-depot.cjs')

const {digestIDsFromBalAddress} = require('../util/digest-ids-from-bal-address.cjs')
const {getBalAddressVersion} = require('../util/get-bal-address-version.cjs')
const MS = require('./strategies/multi-sources/index.cjs')
const BAL = require('./strategies/bal/index.cjs')

const prepareBalData = require('./sources/bal.cjs')
const importFromApiDepot = require('./import-from-api-depot.cjs')

const communesLocauxAdressesDataPath = process.env.COMMUNES_LOCAUX_ADRESSES_DATA_PATH || 'data/communes-locaux-adresses.json'

const communesLocauxAdresses = require(`../../${communesLocauxAdressesDataPath}`)

const locauxAdressesIndex = keyBy(communesLocauxAdresses, 'codeCommune')

const IS_GENERATE_BANID_ON_ASSEMBLY = process.env.IS_GENERATE_BANID_ON_ASSEMBLY === 'true'

async function getSourceData(sourceName, codeCommune) {
  const adresses = await source(sourceName).getAdresses(codeCommune)
  const prepareData = require(`./sources/${sourceName}.cjs`)
  return prepareData(adresses, {codeCommune})
}

async function getMultiSourcesData(codeCommune) {
  const multiSourcesInputs = [
    'ign-api-gestion',
    'cadastre',
    'ftth'
  ]

  return bluebird.mapSeries(multiSourcesInputs, async sourceName => {
    const data = await getSourceData(sourceName, codeCommune)
    return {...data, source: sourceName}
  })
}

async function getBalData(codeCommune, revision) {
  const adresses = await importFromApiDepot(revision)
  return prepareBalData(adresses, {codeCommune})
}

async function getDistrictIDFromMainDB(codeCommune) {
  const {getDistrictsFromCog} = await import('../api/district/models.js')
  const district = (await getDistrictsFromCog(codeCommune))?.[0]
  const districtID = district?.id
  return districtID
}

async function composeCommune(codeCommune, ignoreIdConfig) {
  try {
    const communeCOG = getCommuneCOG(codeCommune)
    const commune = await getCommune(codeCommune)

    if (!ignoreIdConfig && commune?.withBanId) {
      console.info(`La commune ${codeCommune} est gérée avec Ban ID => composition ignorée`)
      return false
    }

    const compositionOptions = commune?.compositionOptions || {}

    if (!communeCOG) {
      throw new Error(`La commune ${codeCommune} n’existe pas.`)
    }

    const currentRevision = await getCurrentRevision(codeCommune)

    if (!compositionOptions.force && currentRevision && commune?.idRevision === currentRevision?._id) {
      console.log(`${codeCommune} | révision source inchangée => composition ignorée`)
      return false
    }

    const isBAL = Boolean(currentRevision)

    // La bloc suivant garantit qu'il n'y a pas de retour en arrière.
    // Ne sera plus nécessaire quand l'API de dépôt contiendra 100% des BAL contenues dans la BAN
    if (!isBAL && commune?.typeComposition === 'bal') {
      console.log(`${codeCommune} | passage de 'bal' à 'assemblage' interdit => composition ignorée`)
      return false
    }

    const balData = isBAL && await getBalData(codeCommune, currentRevision)
    const multiSourcesData = !isBAL && await getMultiSourcesData(codeCommune)

    const pseudoCodeVoieGenerator = await createPseudoCodeVoieGenerator(codeCommune)

    const composeVoiesOptions = {
      codeCommune,
      pseudoCodeVoieGenerator,
      forceCertification: commune?.forceCertification
    }

    const composedVoies = isBAL
      ? await BAL.buildVoies(balData, composeVoiesOptions)
      : await MS.buildVoies(multiSourcesData, composeVoiesOptions)

    const voies = composedVoies.map(v => ({
      type: 'voie',
      ...omit(v, 'numeros')
    }))

    const existingVoiesIds = new Set(chain(composedVoies).map('idVoie').uniq().value())
    const buildLieuxDitsOptions = {codeCommune, pseudoCodeVoieGenerator, existingVoiesIds}

    const lieuxDits = isBAL
      ? await BAL.buildLieuxDits(balData, buildLieuxDitsOptions)
      : await MS.buildLieuxDits(multiSourcesData, buildLieuxDitsOptions)

    let districtID
    if (isBAL) {
      const balAddressVersion = getBalAddressVersion(balData.adresses[0])
      districtID = digestIDsFromBalAddress(balData.adresses[0], balAddressVersion)?.districtID
    } else if (IS_GENERATE_BANID_ON_ASSEMBLY) {
      districtID = await getDistrictIDFromMainDB(codeCommune)
      if (!districtID) {
        throw new Error(`Aucun district ID trouvé pour la commune ${codeCommune}`)
      }
    }

    const voiesToPersist = !isBAL && IS_GENERATE_BANID_ON_ASSEMBLY
      ? [...voies.map(v => ({banIdDistrict: districtID, ...v})), ...lieuxDits.map(ld => ({banIdDistrict: districtID, ...ld}))]
      : [...voies, ...lieuxDits]

    const numeros = chain(composedVoies)
      .map(v => v.numeros.map(n => ({
        codeCommune,
        idVoie: v.idVoie,
        ...(!isBAL && IS_GENERATE_BANID_ON_ASSEMBLY ? {banId: uuidv4()} : {}),
        ...(!isBAL && IS_GENERATE_BANID_ON_ASSEMBLY ? {banIdMainCommonToponym: v.banId,} : {}),
        ...(!isBAL && IS_GENERATE_BANID_ON_ASSEMBLY ? {banIdDistrict: districtID} : {}),
        ...n
      })))
      .flatten()
      .value()

    const nbNumeros = voies.reduce((acc, voie) => acc + voie.nbNumeros, 0)
    const nbNumerosCertifies = numeros.filter(n => n.certifie).length

    if (!geo[codeCommune]) {
      console.warn(`La commune ${codeCommune} n'a pas de données géographiques associées dans le fichier geo.json`)
    }

    const communeRecord = {
      banId: districtID,
      nomCommune: communeCOG.nom,
      population: communeCOG.population,
      departement: pick(getDepartement(communeCOG.departement), 'nom', 'code'),
      region: pick(getRegion(communeCOG.region), 'nom', 'code'),
      codesPostaux: communeCOG.codesPostaux || [],
      displayBBox: geo[codeCommune]?.bbox,
      typeCommune: communeCOG.type,
      nbNumeros,
      nbNumerosCertifies,
      nbVoies: voies.length,
      nbLieuxDits: lieuxDits.length,
      typeComposition: isBAL ? 'bal' : 'assemblage',
      idRevision: currentRevision?._id,
      dateRevision: currentRevision?.publishedAt,
      withBanId: false
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
    return true
  } catch (error) {
    console.error(`Erreur lors de la composition de la commune ${codeCommune}: ${error.message}`)
    return false
  }
}

module.exports = composeCommune
