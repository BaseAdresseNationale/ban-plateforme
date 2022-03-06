/* eslint no-await-in-loop: off */
const Keyv = require('keyv')
const Cache = require('lru-cache')
const ms = require('ms')
const got = require('got')

let _db

function db() {
  if (!_db) {
    _db = new Keyv('sqlite://data/communes-50m.sqlite')
  }

  return _db
}

async function getCommunesFeatures() {
  const communesFile = await got('http://etalab-datasets.geo.data.gouv.fr/contours-administratifs/2022/geojson/communes-50m.geojson').json()
  return communesFile.features
}

async function prepareContours() {
  const features = await getCommunesFeatures()
  await db().clear()

  for (const feature of features) {
    await db().set(feature.properties.code, feature)
  }
}

const cache = new Cache({max: 20, maxAge: ms('10m')})

// Prune cache every 10m
setInterval(() => cache.prune(), ms('10m'))

async function getContour(codeCommune) {
  const cacheEntry = cache.get(codeCommune)

  if (cacheEntry) {
    return cacheEntry
  }

  const contourCommune = await db().get(codeCommune)

  if (contourCommune) {
    cache.set(codeCommune, contourCommune)
    return contourCommune
  }
}

module.exports = {getContour, prepareContours}
