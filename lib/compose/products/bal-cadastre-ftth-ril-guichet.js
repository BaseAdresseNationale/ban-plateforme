const {uniq} = require('lodash')

const SOURCES_LO = ['bal', 'cadastre', 'ftth', 'insee-ril']
const SOURCES_API_GESTION = [
  'ign-api-gestion-municipal_administration',
  'ign-api-gestion-sdis',
  'ign-api-gestion-ign',
  'ign-api-gestion-laposte'
]

function filterAdresses(adressesCommune) {
  const sources = uniq(adressesCommune.map(a => a.source))
  if (sources.includes('ign-api-gestion-municipal_administration')) {
    return adressesCommune.filter(a => [...SOURCES_LO, ...SOURCES_API_GESTION].includes(a.source))
  }

  return adressesCommune.filter(a => SOURCES_LO.includes(a.source))
}

module.exports = {filterAdresses}
