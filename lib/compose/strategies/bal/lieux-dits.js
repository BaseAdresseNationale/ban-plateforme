const {uniqBy} = require('lodash')
const generateIds = require('../../processors/generate-ids')

async function buildLieuxDits(balData, {codeCommune, pseudoCodeVoieGenerator, existingVoiesIds}) {
  generateIds(balData.lieuxDits, {codeCommune, pseudoCodeVoieGenerator})
  return uniqBy(balData.lieuxDits, 'idVoie').filter(ld => !existingVoiesIds.has(ld.idVoie))
}

module.exports = {buildLieuxDits}
