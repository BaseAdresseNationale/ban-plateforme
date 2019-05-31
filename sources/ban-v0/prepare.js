const recomputeCodesVoies = require('../../lib/processing/recompute-codes-voies')
const removeStacked = require('../../lib/processing/remove-stacked')
const updateCommunes = require('../../lib/processing/update-communes')

async function prepareData(adressesCommune) {
  const filteredAdressesCommune = adressesCommune.filter(adresse => {
    if (!adresse.numero || !adresse.nomVoie) {
      return false
    }

    // Suppression des pseudo-numéros, approche grossière pour commencer.
    // Il existe des cas de 5000 légitimes, notamment pour la numérotation métrique et lorsque la voie comporte des 3000 ou 4000
    if (Number.parseInt(adresse.numero, 10) > 5000) {
      return false
    }

    return true
  })

  await updateCommunes(filteredAdressesCommune)
  await recomputeCodesVoies(filteredAdressesCommune)
  return removeStacked(filteredAdressesCommune, 'ban-v0')
}

module.exports = prepareData
