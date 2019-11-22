const {selectNomVoie} = require('./common/nom-voie')
const {selectPosition} = require('./common/position')

const FALLBACK_SOURCES = [
  'cadastre',
  'ftth',
  'ign-api-gestion-municipal_administration',
  'ign-api-gestion-sdis'
]

function filterAdresses(adressesCommune) {
  const adressesBAL = adressesCommune
    .filter(a => a.source === 'bal')
    .filter(a => a.licence !== 'odc-odbl')

  if (adressesBAL.length > 0) {
    return adressesBAL
  }

  return adressesCommune
    .filter(a => FALLBACK_SOURCES.includes(a.source))
    .filter(a => a.licence !== 'odc-odbl')
    .filter(a => a.numero < 5000)
}

module.exports = {filterAdresses, selectNomVoie, selectPosition}
