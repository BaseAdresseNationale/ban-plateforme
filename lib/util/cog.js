const {keyBy} = require('lodash')

const regions = require('@etalab/decoupage-administratif/data/regions.json')
const departements = require('@etalab/decoupage-administratif/data/departements.json')

const communes = require('@etalab/decoupage-administratif/data/communes.json')

const communesActuelles = communes
  .filter(c => ['arrondissement-municipal', 'commune-actuelle'].includes(c.type))

const communesDeleguees = communes
  .filter(c => ['commune-deleguee', 'commune-associee'].includes(c.type))

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
  return communes
    .filter(c => (!codeDepartement || c.departement === codeDepartement))
    .map(c => c.code).filter(c => !['75056', '13055', '69123'].includes(c))
}

function getCodeDepartement(codeCommune) {
  return codeCommune.startsWith('97') ? codeCommune.slice(0, 3) : codeCommune.slice(0, 2)
}

function getCommune(codeCommune) {
  return communesActuellesIndex[codeCommune]
}

function getDepartement(codeDepartement) {
  return departementsIndex[codeDepartement]
}

function getRegion(codeRegion) {
  return regionsIndex[codeRegion]
}

function getCommunes() {
  return communesActuelles
}

function codeCommuneExists(codeCommune) {
  return codeCommune in communesActuellesIndex || anciensCodesIndex.has(codeCommune)
}

module.exports = {
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
