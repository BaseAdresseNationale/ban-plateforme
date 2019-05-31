const {createGazetteer} = require('@etalab/gazetteer')
const {getCommuneActuelle, getMostRecentCommune} = require('../cog')

const gPromise = createGazetteer({cache: true})

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

  const adressesGeo = adresses.filter(a => a.position)

  const g = await gPromise

  await Promise.all(adressesGeo.map(async adresse => {
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
}

module.exports = updateCommunes
