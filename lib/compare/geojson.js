const {promisify} = require('util')
const gunzip = promisify(require('zlib').gunzip)
const {keyBy} = require('lodash')
const {readFile} = require('fs-extra')

async function loadFeatures(filePath) {
  const fileContent = await readFile(filePath)
  const {features} = JSON.parse(await gunzip(fileContent))
  return keyBy(features, f => f.properties.code)
}

const communesPromise = loadFeatures('communes-100m.geojson.gz')
const arrondissementsPromise = loadFeatures('arrondissements-municipaux.geojson.gz')
const departementsPromise = loadFeatures('departements-100m.geojson.gz')

async function getCommuneFeature(codeCommune) {
  const communes = await communesPromise
  const arrondissements = await arrondissementsPromise
  return communes[codeCommune] || arrondissements[codeCommune]
}

async function getDepartementFeature(codeDepartement) {
  const departements = await departementsPromise
  return departements[codeDepartement]
}

module.exports = {getCommuneFeature, getDepartementFeature}
