const {selectNomVoie} = require('./common/nom-voie')
const {selectPosition} = require('./common/position')

const SOURCES = [
  'bal',
  'cadastre',
  'ftth',
  'ign-api-gestion-municipal_administration',
  'ign-api-gestion-sdis'
]

function filterAdresses(adressesCommune) {
  return adressesCommune
    .filter(a => SOURCES.includes(a.source))
    .filter(a => a.licence !== 'odc-odbl')
    .filter(a => a.numero < 5000)
}

module.exports = {filterAdresses, selectNomVoie, selectPosition}
