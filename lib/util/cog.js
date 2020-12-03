const {keyBy, groupBy, maxBy, uniq, flattenDeep} = require('lodash')
const historiqueCommunes = require('@etalab/decoupage-administratif/graph-communes')
const departements = require('@etalab/decoupage-administratif/data/departements.json')
const communes = require('@etalab/decoupage-administratif/data/communes.json')
  .filter(c => ['arrondissement-municipal', 'commune-actuelle'].includes(c.type))

const departementsIndex = keyBy(departements, 'code')
const communesIndex = keyBy(communes, 'code')

function getPLMCodeCommune(codeArrondissement) {
  const arrondissementMunicipal = communesIndex[codeArrondissement]
  if (arrondissementMunicipal && arrondissementMunicipal.commune) {
    return arrondissementMunicipal.commune
  }
}

function getNomCommune(codeCommune) {
  if (codeCommune in communesIndex) {
    return communesIndex[codeCommune].nom
  }
}

const arrondissementsMunicipaux = communes
  .filter(c => c.type === 'arrondissement-municipal')
  .map(c => ({code: c.code, nom: c.nom, type: 'COM'}))

const byCodeCommune = groupBy(historiqueCommunes.concat(arrondissementsMunicipaux), h => `${h.type}${h.code}`)

function getMostRecentCommune(codeCommune) {
  return maxBy(byCodeCommune[`COM${codeCommune}`], c => c.dateFin || '9999-99-99')
}

function communeToCommuneActuelle(commune) {
  if (commune.pole) {
    return communeToCommuneActuelle(commune.pole)
  }

  if (commune.successeur) {
    return communeToCommuneActuelle(commune.successeur)
  }

  if (!commune.dateFin && commune.type === 'COM') {
    return commune
  }

  if (commune.pole) {
    return communeToCommuneActuelle(commune.pole)
  }
}

function getCommuneActuelle(codeCommune) {
  const communePlusRecente = getMostRecentCommune(codeCommune)
  if (communePlusRecente) {
    return communeToCommuneActuelle(communePlusRecente)
  }
}

function getCodesDepartements() {
  return Object.keys(departementsIndex)
}

function getCodesMembres(commune) {
  return uniq([
    commune.code,
    ...flattenDeep((commune.membres || []).map(getCodesMembres))
  ])
}

function getCodesCommunes(codeDepartement) {
  return communes
    .filter(c => (!codeDepartement || c.departement === codeDepartement))
    .map(c => c.code).filter(c => !['75056', '13055', '69123'].includes(c))
}

function getCodeDepartement(codeCommune) {
  return codeCommune.startsWith('97') ? codeCommune.substr(0, 3) : codeCommune.substr(0, 2)
}

function getCommune(codeCommune) {
  return communesIndex[codeCommune]
}

module.exports = {
  getCommune,
  getMostRecentCommune,
  getCommuneActuelle,
  getCodesDepartements,
  getCodesMembres,
  getCodesCommunes,
  getCodeDepartement,
  getPLMCodeCommune,
  getNomCommune
}
