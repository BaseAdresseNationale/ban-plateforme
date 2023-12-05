const {uniqBy} = require('lodash')
const {beautifyUppercased} = require('../../../util/string.cjs')
const generateIds = require('../../processors/generate-ids.cjs')
const {digestIDsFromBalAddress} = require('../../../util/digest-ids-from-bal-address.cjs')
const {getBalAddressVersion} = require('../../../util/get-bal-address-version.cjs')

async function buildLieuxDits(balData, {codeCommune, pseudoCodeVoieGenerator, existingVoiesIds}) {
  generateIds(balData.lieuxDits, {codeCommune, pseudoCodeVoieGenerator})
  return uniqBy(balData.lieuxDits, 'idVoie').filter(ld => !existingVoiesIds.has(ld.idVoie))
    .map(lieuDit => {
      const {uidAdresse, idBanCommune, idBanToponyme, ...lieuDitRest} = lieuDit
      const balAddressVersion = getBalAddressVersion(lieuDit)
      const {mainTopoID, districtID} = digestIDsFromBalAddress(lieuDit, balAddressVersion)
      return {
        ...lieuDitRest,
        banId: mainTopoID,
        banIdDistrict: districtID,
        nomVoie: beautifyUppercased(lieuDit.nomVoie)
      }
    })
}

module.exports = {buildLieuxDits}
