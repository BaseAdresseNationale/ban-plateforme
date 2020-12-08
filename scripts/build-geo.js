#!/usr/bin/env node
const {createGunzip} = require('zlib')
const {join} = require('path')
const got = require('got')
const {center, bbox} = require('@turf/turf')
const getStream = require('get-stream')
const {outputJson} = require('fs-extra')

const communes = 'http://etalab-datasets.geo.data.gouv.fr/contours-administratifs/latest/geojson/communes-100m.geojson.gz'
const arrondissements = 'http://etalab-datasets.geo.data.gouv.fr/contours-administratifs/latest/geojson/arrondissements-municipaux-100m.geojson.gz'

async function getFeatures(url) {
  const buffer = await getStream.buffer(
    got.stream(url).pipe(createGunzip())
  )

  return JSON.parse(buffer.toString()).features
}

function toPrecision(float, precision) {
  const matrix = 10 ** precision
  return Math.round(float * matrix) / matrix
}

function getCenter(feature) {
  const centerFeature = center(feature)
  return centerFeature.geometry.coordinates.map(c => toPrecision(c, 3))
}

function getBbox(feature) {
  return bbox(feature).map(c => toPrecision(c, 3))
}

async function main() {
  const communesFeatures = await getFeatures(communes)
  const arrondissementsFeatures = await getFeatures(arrondissements)

  const dataset = [...communesFeatures, ...arrondissementsFeatures].map(feature => {
    return {
      center: getCenter(feature),
      bbox: getBbox(feature),
      code: feature.properties.code,
      nom: feature.properties.nom
    }
  })

  const index = dataset.reduce((acc, data) => {
    acc[data.code] = {center: data.center, bbox: data.bbox, nom: data.nom}
    return acc
  }, {})

  await outputJson(join(__dirname, '..', 'geo.json'), index)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
