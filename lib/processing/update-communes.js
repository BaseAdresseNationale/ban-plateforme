const {createGazetteer} = require('@etalab/gazetteer')
const {getCommuneActuelle, getMostRecentCommune} = require('../cog')

async function updateCommunes(adresses) {
  const g = await createGazetteer()
  await Promise.all(adresses.map(async adresse => {
    const codeCommune = adresse
    const communeActuelle = getCommuneActuelle(codeCommune)

    if (communeActuelle.code !== codeCommune) {
      adresse.codeCommune = communeActuelle.code
      adresse.nomCommune = communeActuelle.nom
      adresse.codeAncienneCommune = codeCommune
      adresse.nomAncienneCommune = getMostRecentCommune(codeCommune).nom
    }

    if (adresse.position) {
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
    }
  }))
}

module.exports = updateCommunes
