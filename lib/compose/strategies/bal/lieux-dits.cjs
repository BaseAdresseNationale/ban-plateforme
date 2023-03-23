const {uniqBy} = require('lodash')
const {beautifyUppercased} = require('../../../util/string.cjs')
const generateIds = require('../../processors/generate-ids.cjs')

async function buildLieuxDits(balData, {codeCommune, pseudoCodeVoieGenerator, existingVoiesIds}) {
  generateIds(balData.lieuxDits, {codeCommune, pseudoCodeVoieGenerator})
  return uniqBy(balData.lieuxDits, 'idVoie').filter(ld => !existingVoiesIds.has(ld.idVoie))
    .map(lieuDit => ({
      ...lieuDit,
      nomVoie: beautifyUppercased(lieuDit.nomVoie)
    }))
}

module.exports = {buildLieuxDits}
