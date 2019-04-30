const {chain, mapValues, countBy} = require('lodash')

function asPosKey(position, precision = 6) {
  return `${position.coordinates[0].toFixed(precision)},${position.coordinates[1].toFixed(precision)}`
}

function removeStacked(adresses, sourceName) {
  return chain(adresses)
    .groupBy('codeCommune')
    .map(adressesCommune => {
      const stacked6 = mapValues(
        countBy(
          adressesCommune.filter(a => a.position),
          a => asPosKey(a.position, 6)
        ),
        count => count > 10
      )
      const stacked5 = mapValues(
        countBy(
          adressesCommune.filter(a => a.position),
          a => asPosKey(a.position, 5)
        ),
        count => count > 30
      )
      const stacked4 = mapValues(
        countBy(
          adressesCommune.filter(a => a.position),
          a => asPosKey(a.position, 4)
        ),
        count => count > 100
      )
      const filtered = adressesCommune.filter(a => !a.position || (!stacked4[asPosKey(a.position, 4)] && !stacked5[asPosKey(a.position, 5)] && !stacked6[asPosKey(a.position, 6)]))
      if (filtered.length !== adressesCommune.length) {
        console.log(`${adressesCommune[0].codeCommune} : suppression de ${adressesCommune.length - filtered.length} adresses empilées (${sourceName})`)
      }

      return filtered
    })
    .flatten()
    .value()
}

module.exports = removeStacked
