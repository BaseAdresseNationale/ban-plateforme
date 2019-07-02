const recomputeCodesVoies = require('../recompute-codes-voies')
const removeStacked = require('../remove-stacked')
const updateCommunes = require('../update-communes')

async function prepareData(adressesCommune) {
  const filteredAdresses = adressesCommune.filter(a => {
    // Suppression des pseudo-numéros, approche grossière pour commencer.
    // Il existe des cas de 5000 légitimes, notamment pour la numérotation métrique et lorsque la voie comporte des 3000 ou 4000
    if (Number.parseInt(a.numero, 10) > 5000) {
      return false
    }

    return true
  })

  await updateCommunes(filteredAdresses)
  await recomputeCodesVoies(filteredAdresses)
  return {adresses: removeStacked(filteredAdresses, 'ftth'), stats: {}}
}

module.exports = prepareData
