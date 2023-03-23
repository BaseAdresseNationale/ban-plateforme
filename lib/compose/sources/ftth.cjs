const recomputeCodesVoies = require('../processors/recompute-codes-voies.cjs')
const removeStacked = require('../processors/remove-stacked.cjs')
const updateCommunes = require('../processors/update-communes.cjs')
const filterOutOfCommune = require('../processors/filter-out-of-commune.cjs')

async function prepareData(adressesCommune, {codeCommune}) {
  const context = {adresses: adressesCommune, codeCommune}

  await filterOutOfCommune(context, 0.2)

  const filteredAdresses = context.adresses.filter(a => {
    // Suppression des pseudo-numéros, approche grossière pour commencer.
    // Il existe des cas de 5000 légitimes, notamment pour la numérotation métrique et lorsque la voie comporte des 3000 ou 4000
    if (a.numero === 0 || a.numero >= 5000) {
      return false
    }

    if (a.nomVoie.toLowerCase().includes('parcelle')) {
      return false
    }

    return true
  })

  await updateCommunes(filteredAdresses)
  await recomputeCodesVoies(filteredAdresses)
  return {adresses: removeStacked(filteredAdresses, 'ftth'), stats: {}}
}

module.exports = prepareData
