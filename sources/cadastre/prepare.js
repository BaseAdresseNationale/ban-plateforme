const recomputeCodesVoies = require('../../lib/merge/recompute-codes-voies')
const updateCommunes = require('../../lib/merge/update-communes')

async function prepareData(adressesCommune) {
  await updateCommunes(adressesCommune)
  await recomputeCodesVoies(adressesCommune)
  return {adresses: adressesCommune, stats: {}}
}

module.exports = prepareData
