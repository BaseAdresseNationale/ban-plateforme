const recomputeCodesVoies = require('../processors/recompute-codes-voies')
const updateCommunes = require('../processors/update-communes')

async function prepareData(adressesCommune) {
  await updateCommunes(adressesCommune)
  await recomputeCodesVoies(adressesCommune)
  return {adresses: adressesCommune, stats: {}}
}

module.exports = prepareData
