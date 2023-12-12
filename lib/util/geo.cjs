const {range, min, flatten} = require('lodash')
const {concave, buffer, bbox, bboxPolygon, centroid, feature, featureCollection, truncate, pointOnFeature, booleanPointInPolygon, lineString, pointToLineDistance} = require('@turf/turf')
const proj = require('@etalab/project-legal')
const {pointToTileFraction} = require('@mapbox/tilebelt')

const extent = 4096

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

  const nestedTile = []
  const tiles = range(minZoom, maxZoom + 1).map(zoom => {
    const [xf, yf, z] = pointToTileFraction(lon, lat, zoom)

    // Positon theroique
    const x = Math.floor(xf)
    const y = Math.floor(yf)

    // Sauf que le rendu est sur mvt v2.1 sur une etendue (extent)
    const overX = (Math.ceil(xf) - xf) < 1 / (2 * extent)
    const overY = (Math.ceil(yf) - yf) < 1 / (2 * extent)
    if (overX || overY) { // L'arrondit du pixel depassera l'etendue
      // La position s'affichera sur la tuile suivante ${z}/${overX ? x + 1 : x}/${overY ? y + 1 : y}`)
      nestedTile.push(`${z}/${overX ? x + 1 : x}/${overY ? y + 1 : y}`)
    }

    return `${z}/${x}/${y}`
  })

  return {lon, lat, x, y, tiles: [...tiles, ...nestedTile]}
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
