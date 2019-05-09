const {chain} = require('lodash')
const bluebird = require('bluebird')
const {createGazetteer} = require('@etalab/gazetteer')
const {getCommuneActuelle, getMostRecentCommune} = require('../cog')

async function updateCommunes(adresses) {
  adresses.forEach(adresse => {
    const {codeCommune} = adresse
    const communeActuelle = getCommuneActuelle(codeCommune)

    adresse.nomCommune = communeActuelle.nom

    if (communeActuelle.code !== codeCommune) {
      adresse.codeCommune = communeActuelle.code
      adresse.codeAncienneCommune = codeCommune
      adresse.nomAncienneCommune = getMostRecentCommune(codeCommune).nom
    }
  })

  const communesGroups = chain(adresses)
    .filter(a => a.position)
    .groupBy('codeCommune')
    .values()
    .value()

  const g = await createGazetteer({cache: true})

  await bluebird.each(communesGroups, async adressesCommune => {
    await Promise.all(adressesCommune.map(async adresse => {
      const [lon, lat] = adresse.position.coordinates
      const result = await g.find({lon, lat})

      if (!result) {
        console.log(`Contexte introuvable pour les coordonnées ${[lon, lat]}`)
        return
      }

      if (result.communeAncienne && result.commune.code === adresse.codeCommune) {
        adresse.codeAncienneCommune = result.communeAncienne.code
        adresse.nomAncienneCommune = result.communeAncienne.nom
      }
    }))
    g.clearCache()
  })
}

module.exports = updateCommunes
