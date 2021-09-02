const Keyv = require('@livingdata/keyv')
const Cache = require('lru-cache')
const ms = require('ms')

const cache = new Cache({max: 20, maxAge: ms('10m')})

// Prune cache every 10m
setInterval(() => cache.prune(), ms('10m'))

const contoursCommunes = new Keyv('sqlite://data/communes-50m.sqlite')
const contoursArrondissements = new Keyv('sqlite://data/arrondissements-municipaux-50m.sqlite')

async function getContour(codeCommune) {
  const cacheEntry = cache.get(codeCommune)

  if (cacheEntry) {
    return cacheEntry
  }

  const contourCommune = await contoursCommunes.get(codeCommune)

  if (contourCommune) {
    cache.set(codeCommune, contourCommune)
    return contourCommune
  }

  const contourArrondissement = await contoursArrondissements.get(codeCommune)

  if (contourArrondissement) {
    cache.set(codeCommune, contourArrondissement)
    return contourArrondissement
  }
}

module.exports = {getContour}
