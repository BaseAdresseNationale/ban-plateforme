const recomputeCodesVoies = require('../recompute-codes-voies')
const updateCommunes = require('../update-communes')

async function prepareData(adressesCommune) {
  await updateCommunes(adressesCommune)
  await recomputeCodesVoies(adressesCommune)
  return {adresses: adressesCommune, stats: {}}
}

module.exports = prepareData
