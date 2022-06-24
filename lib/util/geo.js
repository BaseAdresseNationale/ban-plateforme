const {range, min, flatten} = require('lodash')
const {concave, buffer, bbox, bboxPolygon, centroid, feature, featureCollection, truncate, pointOnFeature, booleanPointInPolygon, lineString, pointToLineDistance} = require('@turf/turf')
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

function getCenterFromPoints(points = []) {
  if (points.length === 0) {
    return
  }

  const fc = featureCollection(points.map(p => feature(p)))

  if (points.length === 1) {
    return truncate(feature(points[0])).geometry
  }

  if (points.length === 2 || points.length === 3) {
    return truncate(centroid(fc)).geometry
  }

  const concaveHull = concave(fc, {maxEdge: 0.1, units: 'kilometers'})

  if (!concaveHull) {
    return truncate(centroid(fc)).geometry
  }

  return truncate(pointOnFeature(concaveHull)).geometry
}

function roundCoordinate(coordinate, precision = 6) {
  return Number.parseFloat(coordinate.toFixed(precision))
}

function harmlessProj([lon, lat]) {
  const projectedCoordinates = proj([lon, lat])

  if (!projectedCoordinates || projectedCoordinates.length !== 2) {
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

function getRings(polygon) {
  if (polygon.geometry.type === 'Polygon') {
    return polygon.geometry.coordinates
  }

  if (polygon.geometry.type === 'MultiPolygon') {
    return flatten(polygon.geometry.coordinates)
  }

  throw new Error('La géométrie utilisée n’est pas un polygone')
}

function distanceToPolygon(point, polygon) {
  if (booleanPointInPolygon(point, polygon)) {
    return 0
  }

  return min(getRings(polygon).map(ring => pointToLineDistance(point, lineString(ring))))
}

module.exports = {computeBufferedBbox, derivePositionProps, getCenterFromPoints, distanceToPolygon, harmlessProj}
