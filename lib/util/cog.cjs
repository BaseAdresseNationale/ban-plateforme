const {chain, keyBy} = require('lodash')

const communes = require('@etalab/decoupage-administratif/data/communes.json')

const collectivitesOutremer = chain(communes)
  .filter(c => c.collectiviteOutremer)
  .map(c => c.collectiviteOutremer)
  .uniqBy('code')
  .value()

communes.forEach(c => {
  if (c.collectiviteOutremer) {
    c.departement = c.collectiviteOutremer.code
    c.region = c.collectiviteOutremer.code
    c.collectiviteOutremer = undefined
  }
})

const communesActuelles = communes
  .filter(c => ['arrondissement-municipal', 'commune-actuelle'].includes(c.type))

const communesDeleguees = communes
  .filter(c => ['commune-deleguee', 'commune-associee'].includes(c.type))

const regions = [
  ...require('@etalab/decoupage-administratif/data/regions.json'),
  ...collectivitesOutremer
]

const departements = [
  ...require('@etalab/decoupage-administratif/data/departements.json'),
  ...collectivitesOutremer
]

const regionsIndex = keyBy(regions, 'code')
const departementsIndex = keyBy(departements, 'code')
const communesActuellesIndex = keyBy(communesActuelles, 'code')
const communesDelegueesIndex = keyBy(communesDeleguees, 'code')

const anciensCodesIndex = new Map()
for (const commune of communesActuelles) {
  const anciensCodes = commune.anciensCodes || []
  for (const ancienCode of anciensCodes) {
    anciensCodesIndex.set(ancienCode, commune)
  }
}

const PLM = new Set(['75056', '13055', '69123'])

function getPLMCodeCommune(codeArrondissement) {
  const arrondissementMunicipal = communesActuellesIndex[codeArrondissement]
  if (arrondissementMunicipal && arrondissementMunicipal.commune) {
    return arrondissementMunicipal.commune
  }
}

function getNomCommune(codeCommune) {
  const commune = communesActuellesIndex[codeCommune] || communesDelegueesIndex[codeCommune]
  if (commune) {
    return commune.nom
  }
}

function getCommuneActuelle(codeCommune) {
  return communesActuellesIndex[codeCommune] || anciensCodesIndex.get(codeCommune)
}

function getCodesDepartements() {
  return Object.keys(departementsIndex)
}

function getCodesCommunes(codeDepartement) {
  return getCommunes()
    .filter(c => (!codeDepartement || c.departement === codeDepartement))
    .map(c => c.code)
}

function getCodeDepartement(codeCommune) {
  const prefix = codeCommune.slice(0, 2)
  return prefix >= '97' ? codeCommune.slice(0, 3) : codeCommune.slice(0, 2)
}

function getCommune(codeCommune, withCommuneDel) {
  if (withCommuneDel) {
    return communesActuellesIndex[codeCommune] || communesDelegueesIndex[codeCommune]
  }

  return communesActuellesIndex[codeCommune]
}

function getDepartement(codeDepartement) {
  return departementsIndex[codeDepartement]
}

function getRegion(codeRegion) {
  return regionsIndex[codeRegion]
}

function getCommunes(withPLM = false) {
  if (withPLM) {
    return communesActuelles
  }

  return communesActuelles.filter(c => !PLM.has(c.code))
}

function codeCommuneExists(codeCommune) {
  return codeCommune in communesActuellesIndex || anciensCodesIndex.has(codeCommune)
}

function isPLM(codeCommune) {
  return PLM.has(codeCommune)
}

module.exports = {
  isPLM,
  getCommune,
  getCommuneActuelle,
  getCodesDepartements,
  getCodesCommunes,
  getCodeDepartement,
  getPLMCodeCommune,
  getNomCommune,
  getDepartement,
  getRegion,
  getCommunes,
  codeCommuneExists
}
