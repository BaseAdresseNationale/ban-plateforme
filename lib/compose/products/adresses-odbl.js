const {uniq} = require('lodash')

function filterAdresses(adressesCommune) {
  const sources = uniq(adressesCommune.map(a => a.source))
  if (sources.includes('bal')) {
    return adressesCommune.filter(a => a.source === 'bal')
  }

  return adressesCommune.filter(a => a.source === 'cadastre' || (a.source.startsWith('ign-api-gestion') && a.source !== 'ign-api-gestion-dgfip'))
}

module.exports = {filterAdresses}
