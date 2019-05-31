const {keyBy, groupBy, maxBy, uniq, flattenDeep} = require('lodash')
const historiqueCommunes = require('@etalab/decoupage-administratif/graph-communes')
const departements = require('@etalab/decoupage-administratif/data/departements.json')
const communes = require('@etalab/decoupage-administratif/data/communes.json')

const departementsIndex = keyBy(departements, 'code')

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
    ...flattenDeep((commune.membres || []).map(getCodesMembres)),
    ...flattenDeep(commune.predecesseur ? getCodesMembres(commune.predecesseur) : [commune.code])
  ])
}

function getCodesCommunes(codeDepartement) {
  return communes.filter(c => c.departement === codeDepartement).map(c => c.code)
}

module.exports = {getMostRecentCommune, getCommuneActuelle, getCodesDepartements, getCodesMembres, getCodesCommunes}
