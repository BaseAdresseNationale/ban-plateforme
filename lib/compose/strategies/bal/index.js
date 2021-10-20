const generateIds = require('../../processors/generate-ids')
const computeGroups = require('../../processors/compute-groups')
const consolidateVoies = require('../../consolidate-voies')

function buildVoiesBAL(adresses, {codeCommune, pseudoCodeVoieGenerator, forceCertification}) {
  const adressesWithGroups = computeGroups(adresses, false)
  return consolidateVoies(adressesWithGroups, {pseudoCodeVoieGenerator, codeCommune, forceCertification})
}

async function buildLieuxDitsBAL(balData, {codeCommune, pseudoCodeVoieGenerator, existingVoiesIds}) {
  generateIds(balData.lieuxDits, {codeCommune, pseudoCodeVoieGenerator})
  return balData.lieuxDits.filter(ld => !existingVoiesIds.has(ld.idVoie))
}

module.exports = {buildVoiesBAL, buildLieuxDitsBAL}
