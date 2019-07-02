const {uniq} = require('lodash')

function filterAdresses(adressesCommune) {
  const sources = uniq(adressesCommune.map(a => a.source))
  if (sources.includes('bal')) {
    return adressesCommune.filter(a => a.source === 'bal')
  }

  return adressesCommune.filter(a => ['cadastre', 'ftth', 'ign-api-gestion-municipal_administration', 'ign-api-gestion-sdis'].includes(a.source))
}

module.exports = {filterAdresses}
