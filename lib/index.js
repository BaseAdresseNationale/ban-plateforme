const {groupBy} = require('lodash')
const consolidateVoies = require('./processing/consolidate-voies')

function merge(adresses) {
  const voies = []
  const adressesCommunes = groupBy(adresses, 'codeCommune')
  Object.keys(adressesCommunes).forEach(codeCommune => {
    consolidateVoies(adressesCommunes[codeCommune]).forEach(v => voies.push(v))
  })
  return voies
}

module.exports = merge
