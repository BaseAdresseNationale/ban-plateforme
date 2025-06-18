#!/usr/bin/env node
/* eslint unicorn/prefer-object-from-entries: off */
require('dotenv').config()
const {createGunzip} = require('zlib')
const {join} = require('path')
const {center, bbox} = require('@turf/turf')
const getStream = require('get-stream')
const {outputJson} = require('fs-extra')
const fetch = require('../lib/util/fetch.cjs')

const communes = 'http://etalab-datasets.geo.data.gouv.fr/contours-administratifs/2025/geojson/communes-100m-2025-01-08.geojson.gz'

async function getFeatures(url) {
  const response = await fetch(url)
  const unzippedStream = response.body.pipe(createGunzip())
  const bufferData = await getStream.buffer(unzippedStream)

  return JSON.parse(bufferData.toString()).features
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

  const dataset = communesFeatures.map(feature => ({
    center: getCenter(feature),
    bbox: getBbox(feature),
    code: feature.properties.code,
    nom: feature.properties.nom
  }))

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
