const {uniqBy} = require('lodash')
const {beautifyUppercased} = require('../../../util/string.cjs')
const {digestIDsFromBalUIDs} = require('../../../util/digest-ids-from-bal-uids.cjs')
const generateIds = require('../../processors/generate-ids.cjs')

async function buildLieuxDits(balData, {codeCommune, pseudoCodeVoieGenerator, existingVoiesIds}) {
  generateIds(balData.lieuxDits, {codeCommune, pseudoCodeVoieGenerator})
  return uniqBy(balData.lieuxDits, 'idVoie').filter(ld => !existingVoiesIds.has(ld.idVoie))
    .map(lieuDit => {
      const {uidAdresse, ...lieuDitRest} = lieuDit
      const {mainTopoID, districtID} = digestIDsFromBalUIDs(uidAdresse)
      return {
        ...lieuDitRest,
        banId: mainTopoID,
        banIdDistrict: districtID,
        nomVoie: beautifyUppercased(lieuDit.nomVoie)
      }
    })
}

module.exports = {buildLieuxDits}
