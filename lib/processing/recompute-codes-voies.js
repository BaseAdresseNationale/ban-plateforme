const {first, memoize} = require('lodash')
const {createFantoirCommune} = require('@etalab/fantoir')

async function recomputeCodesVoies(adressesCommune) {
  if (adressesCommune.length === 0) {
    return
  }

  const {codeCommune} = first(adressesCommune)

  const fantoirCommune = await createFantoirCommune(codeCommune)
  const findVoie = memoize((nomVoie, communeScope) => {
    return fantoirCommune.findVoie(nomVoie, communeScope)
  }, (nomVoie, communeScope) => `${communeScope || codeCommune}-${nomVoie}`)

  adressesCommune.forEach(adresse => {
    const voie = findVoie(adresse.nomVoie, adresse.codeAncienneCommune)
    if (voie) {
      adresse.idVoie = (`${voie.codeCommune}_${voie.codeFantoir}`).toLowerCase()
    }
  })
}

module.exports = recomputeCodesVoies
