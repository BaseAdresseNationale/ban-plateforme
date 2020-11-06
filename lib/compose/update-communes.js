const {createGazetteer} = require('@etalab/gazetteer')
const debug = require('debug')('adresse-pipeline')
const {getCommuneActuelle, getMostRecentCommune} = require('../util/cog')

const gPromise = createGazetteer({cacheEnabled: true, cacheSize: 30})

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

  function immediate() {
    return new Promise(resolve => {
      setImmediate(() => resolve())
    })
  }

  await Promise.all(adressesGeo.map(async adresse => {
    const [lon, lat] = adresse.position.coordinates
    const result = await g.find({lon, lat})

    // We don't want to block the event loop since it could break database connections
    await immediate()

    if (!result) {
      debug(`Contexte introuvable pour les coordonnées ${[lon, lat]}`)
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
