const {buffer, bbox, bboxPolygon, center, feature, featureCollection, truncate} = require('@turf/turf')
const {harmlessProj} = require('./proj')

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

function derivePositionProps(position) {
  if (!position) {
    return {}
  }

  const [lon, lat] = position.coordinates
  const [x, y] = harmlessProj([lon, lat]) || []
  return {lon, lat, x, y}
}

module.exports = {computeBufferedBbox, derivePositionProps, getCentroidFromPoints}
