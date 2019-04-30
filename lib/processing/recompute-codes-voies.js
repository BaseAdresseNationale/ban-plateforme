const bluebird = require('bluebird')
const {groupBy, first, memoize} = require('lodash')
const {createFantoirCommune} = require('@etalab/fantoir')

async function recomputeCodesVoies(adresses) {
  const adressesCommunes = Object.values(groupBy(adresses, 'codeCommune'))
  await bluebird.each(adressesCommunes, async adressesCommune => {
    const {codeCommune} = first(adressesCommune)
    const fantoirCommune = await createFantoirCommune(codeCommune)
    const findCodeVoie = memoize(nomVoie => {
      const voie = fantoirCommune.findVoie(nomVoie)

      if (voie) {
        return voie.codeFantoir
      }
    })
    adressesCommune.forEach(adresse => {
      adresse.originalCodeVoie = adresse.codeVoie
      adresse.codeVoie = findCodeVoie(adresse.nomVoie) || adresse.originalCodeVoie
    })
  })
}

module.exports = recomputeCodesVoies
