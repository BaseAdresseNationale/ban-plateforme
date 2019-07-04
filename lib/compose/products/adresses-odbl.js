const SOURCES = [
  'bal',
  'cadastre',
  'ign-api-gestion-municipal_administration',
  'ign-api-gestion-sdis',
  'ign-api-gestion-ign',
  'ign-api-gestion-laposte'
]

function filterAdresses(adressesCommune) {
  return adressesCommune.filter(a => SOURCES.includes(a.source))
}

module.exports = {filterAdresses}
