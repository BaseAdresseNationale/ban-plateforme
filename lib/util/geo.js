const {buffer, bbox, bboxPolygon} = require('@turf/turf')

function computeBufferedBbox(features, distanceInMeters) {
  if (!features || features.length === 0) {
    throw new Error('features array must not be empty')
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

module.exports = {computeBufferedBbox}
