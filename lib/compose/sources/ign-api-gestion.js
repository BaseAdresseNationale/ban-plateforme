const {memoize, deburr, trim} = require('lodash')
const recomputeCodesVoies = require('../recompute-codes-voies')
const removeStacked = require('../remove-stacked')
const updateCommunes = require('../update-communes')
const filterOutOfCommune = require('../filter-out-of-commune')

async function prepareData(adressesCommune, {codeCommune}) {
  const stats = {
    initialCount: adressesCommune.length,
    ignored: {
      'no-numero': 0,
      'no-nomVoie': 0,
      'nomVoie-invalide': 0,
      'pseudo-numero': 0
    }
  }

  const context = {adresses: adressesCommune, codeCommune}

  await filterOutOfCommune(context)

  const cleanNomVoie = memoize(nomVoie => {
    const cleanedNomVoie = nomVoie.trim().split('/')[0].split('(')[0]
    if (deburr(cleanedNomVoie).match(/^[a-z]/i)) {
      return cleanedNomVoie
    }

    console.log(`Nom de voie non valide : ${nomVoie}`)
  })

  const cleanedAdresses = context.adresses
    .filter(adresse => {
      if (!adresse.numero) {
        stats.ignored['no-numero']++
        return false
      }

      if (!adresse.nomVoie) {
        stats.ignored['no-nomVoie']++
        return false
      }

      const cleanedNomVoie = cleanNomVoie(adresse.nomVoie)
      if (!cleanedNomVoie) {
        stats.ignored['nomVoie-invalide']++
        return false
      }

      adresse.nomVoie = cleanedNomVoie

      // Suppression des pseudo-numéros, approche grossière pour commencer.
      // Il existe des cas de 5000 légitimes, notamment pour la numérotation métrique et lorsque la voie comporte des 3000 ou 4000
      if (Number.parseInt(adresse.numero, 10) > 5000) {
        stats.ignored['pseudo-numero']++
        return false
      }

      return true
    })
    .map(adresse => {
      const trimmedSuffixe = trim(adresse.suffixe, '-_ ')
      return {
        ...adresse,
        suffixe: trimmedSuffixe || null
      }
    })

  await updateCommunes(cleanedAdresses)
  await recomputeCodesVoies(cleanedAdresses)

  const remaining = cleanedAdresses.length
  const unstackedAdresses = removeStacked(cleanedAdresses, 'ign-api-gestion')
  stats.ignored.stacked = remaining - unstackedAdresses.length
  stats.finalCount = unstackedAdresses.length

  return {
    adresses: unstackedAdresses,
    stats
  }
}

module.exports = prepareData
