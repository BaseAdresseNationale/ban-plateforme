const generateIds = require('../../processors/generate-ids')
const computeGroups = require('../../processors/compute-groups')
const consolidateVoies = require('../../consolidate-voies')

function buildVoiesBAL(adresses, {codeCommune, pseudoCodeVoieGenerator, forceCertification}) {
  const adressesWithGroups = computeGroups(adresses, false)
  return consolidateVoies(adressesWithGroups, {pseudoCodeVoieGenerator, codeCommune, forceCertification})
}

async function buildLieuxDitsBAL(balData, {codeCommune, pseudoCodeVoieGenerator}) {
  generateIds(balData.lieuxDits, {codeCommune, pseudoCodeVoieGenerator})
  return balData.lieuxDits
}

module.exports = {buildVoiesBAL, buildLieuxDitsBAL}
