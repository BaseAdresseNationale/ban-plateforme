const {selectNomVoie} = require('./common/nom-voie')
const {selectPosition} = require('./common/position')

const FALLBACK_SOURCES = [
  'cadastre',
  'ftth',
  'insee-ril',
  'ign-api-gestion-municipal_administration',
  'ign-api-gestion-sdis',
  'ign-api-gestion-ign',
  'ign-api-gestion-laposte'
]

function filterAdresses(adressesCommune) {
  const adressesBAL = adressesCommune
    .filter(a => a.source === 'bal')

  if (adressesBAL.length > 0) {
    return adressesBAL
  }

  return adressesCommune
    .filter(a => FALLBACK_SOURCES.includes(a.source))
    .filter(a => a.numero < 5000)
}

module.exports = {filterAdresses, selectNomVoie, selectPosition}
