const {range} = require('lodash')
const {buffer, bbox, bboxPolygon, center, feature, featureCollection, truncate} = require('@turf/turf')
const proj = require('@etalab/project-legal')
const {pointToTile} = require('@mapbox/tilebelt')

function computeBufferedBbox(features, distanceInMeters) {
  if (!features || features.length === 0) {
    return
  }

  const computedBbox = bbox({type: 'FeatureCollection', features})
  const computedBboxPolygon = bboxPolygon(computedBbox)
  const bufferedBbox = buffer(
    computedBboxPolygon,
    distanceInMeters / 1000,
    {units: 'kilometers', steps: 16}
  )
  return bbox(bufferedBbox).map(c => Number.parseFloat(c.toFixed(4)))
}

function getCentroidFromPoints(points = []) {
  if (points.length > 0) {
    const centerFeature = center(featureCollection(points.map(p => feature(p))))
    return truncate(centerFeature).geometry
  }
}

function roundCoordinate(coordinate, precision = 6) {
  return parseFloat(coordinate.toFixed(precision))
}

function harmlessProj([lon, lat]) {
  const projectedCoordinates = proj([lon, lat])

  if (projectedCoordinates.length !== 2) {
    return []
  }

  return [
    roundCoordinate(projectedCoordinates[0], 2),
    roundCoordinate(projectedCoordinates[1], 2)
  ]
}

function derivePositionProps(position, minZoom, maxZoom) {
  if (!position) {
    return {}
  }

  const lon = roundCoordinate(position.coordinates[0], 6)
  const lat = roundCoordinate(position.coordinates[1], 6)

  const [x, y] = harmlessProj([lon, lat])

  if (!minZoom || !maxZoom) {
    return {lon, lat, x, y}
  }

  const tiles = range(minZoom, maxZoom + 1).map(zoom => {
    const [x, y, z] = pointToTile(lon, lat, zoom)
    return `${z}/${x}/${y}`
  })

  return {lon, lat, x, y, tiles}
}

module.exports = {computeBufferedBbox, derivePositionProps, getCentroidFromPoints}
