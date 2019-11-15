const {selectNomVoie} = require('./common/nom-voie')
const {selectPosition} = require('./common/position')

const SOURCES = [
  'bal',
  'cadastre',
  'ftth',
  'ign-api-gestion-municipal_administration',
  'ign-api-gestion-sdis',
  'ign-api-gestion-ign',
  'ign-api-gestion-laposte'
]

function filterAdresses(adressesCommune) {
  return adressesCommune
    .filter(a => SOURCES.includes(a.source))
    .filter(a => a.numero < 5000)
}

module.exports = {filterAdresses, selectNomVoie, selectPosition}
