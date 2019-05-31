const recomputeCodesVoies = require('../../lib/processing/recompute-codes-voies')
const updateCommunes = require('../../lib/processing/update-communes')

async function prepareData(adressesCommune) {
  await updateCommunes(adressesCommune)
  await recomputeCodesVoies(adressesCommune)
  return adressesCommune
}

module.exports = prepareData
