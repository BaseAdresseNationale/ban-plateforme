const bluebird = require('bluebird')
const debug = require('debug')('adresse-pipeline')
const {getCommuneActuelle, getNomCommune} = require('../../util/cog.cjs')
const gPromise = require('../../util/gazetteer.cjs')

async function updateCommunes(adresses) {
  adresses.forEach(adresse => {
    const {codeCommune} = adresse
    const communeActuelle = getCommuneActuelle(codeCommune)

    adresse.nomCommune = communeActuelle.nom

    if (communeActuelle.code !== codeCommune) {
      adresse.codeCommune = communeActuelle.code
      adresse.codeAncienneCommune = codeCommune
      adresse.nomAncienneCommune = getNomCommune(codeCommune)
    }
  })

  const adressesGeo = adresses.filter(a => a.position)

  const g = await gPromise

  function immediate() {
    return new Promise(resolve => {
      setImmediate(() => resolve())
    })
  }

  await bluebird.mapSeries(adressesGeo, async adresse => {
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
  })

  g.clearCache()
}

module.exports = updateCommunes
