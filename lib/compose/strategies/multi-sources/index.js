const computeGroups = require('../../processors/compute-groups')
const consolidateVoies = require('../../consolidate-voies')

const MULTI_SOURCES = new Set([
  'cadastre',
  'ftth',
  'insee-ril',
  'ign-api-gestion-municipal_administration',
  'ign-api-gestion-sdis',
  'ign-api-gestion-ign',
  'ign-api-gestion-laposte'
])

function buildVoiesMS(adresses, {codeCommune, pseudoCodeVoieGenerator}) {
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

async function buildLieuxDitsMS(sourcesData, {existingVoiesIds}) {
  const cadastreData = sourcesData.find(d => d.source === 'cadastre')

  if (cadastreData) {
    return cadastreData.lieuxDits.filter(ld => !existingVoiesIds.has(ld.idVoie))
  }

  return []
}

module.exports = {buildVoiesMS, buildLieuxDitsMS}
