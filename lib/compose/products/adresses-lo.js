const SOURCES = [
  'bal',
  'cadastre',
  'ftth',
  'ign-api-gestion-municipal_administration',
  'ign-api-gestion-sdis'
]

function filterAdresses(adressesCommune) {
  return adressesCommune.filter(a => SOURCES.includes(a.source) && a.source !== 'odc-odbl')
}

module.exports = {filterAdresses}
