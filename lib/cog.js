const {keyBy, groupBy, maxBy} = require('lodash')
const historiqueCommunes = require('@etalab/decoupage-administratif/data/historique-communes.json')
const departements = require('@etalab/decoupage-administratif/data/departements.json')
const communes = require('@etalab/decoupage-administratif/data/communes.json')

const communesIndex = keyBy(communes, 'code')
const departementsIndex = keyBy(departements, 'code')

const arrondissementsMunicipaux = communes
  .filter(c => c.type === 'arrondissement-municipal')
  .map(c => ({code: c.code, nom: c.nom, type: 'COM'}))

function connectGraph(historiqueCommunes) {
  const byId = keyBy(historiqueCommunes, 'id')
  historiqueCommunes.forEach(h => {
    if (h.successeur) {
      h.successeur = byId[h.successeur]
    }

    if (h.predecesseur) {
      h.predecesseur = byId[h.predecesseur]
    }

    if (h.pole) {
      h.pole = byId[h.pole]
    }

    if (h.membres) {
      h.membres = h.membres.map(m => byId[m])
    }
  })
}

connectGraph(historiqueCommunes)

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

function getNomCommune(codeCommune) {
  if (codeCommune === '97127') {
    return 'Saint-Martin'
  }

  if (codeCommune === '97123') {
    return 'Saint-Barthelemy'
  }

  return communesIndex[codeCommune].nom
}

module.exports = {getMostRecentCommune, getCommuneActuelle, getCodesDepartements, getNomCommune}
