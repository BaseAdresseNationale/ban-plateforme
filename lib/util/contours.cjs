/* eslint no-await-in-loop: off */
const Keyv = require('keyv')
const Cache = require('lru-cache')
const {throttle} = require('lodash')
const ms = require('ms')
const ora = require('ora')
const fetch = require('./fetch.cjs')

const contoursDataPath = process.env.CONTOURS_DATA_PATH || 'data/communes-50m.sqlite'

let _db

function db() {
  if (!_db) {
    _db = new Keyv(`sqlite://${contoursDataPath}`)
  }

  return _db
}

async function getCommunesFeatures() {
  const response = await fetch('https://adresse.data.gouv.fr/data/contours-administratifs/2023/geojson/communes-50m.geojson')
  const communesFile = await response.json()

  return communesFile.features
}

async function prepareContours() {
  const downloadingSpinner = ora('Téléchargement du fichier des contours des communes').start()
  const features = await getCommunesFeatures()
  downloadingSpinner.succeed()

  const cleaningSpinner = ora('Nettoyage de la base SQLite des contours').start()
  await db().clear()
  cleaningSpinner.succeed()

  const writingSpinner = ora('Écriture des contours dans la base SQLite').start()
  const rerenderSpinner = throttle(() => writingSpinner.render(), 100)

  for (const feature of features) {
    await db().set(feature.properties.code, feature)
    writingSpinner.text = `Écriture des contours dans la base SQLite : ${feature.properties.code}`
    rerenderSpinner()
  }

  writingSpinner.succeed('Écriture des contours dans la base SQLite')
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
