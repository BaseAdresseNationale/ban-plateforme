const bluebird = require('bluebird')
const {compact} = require('lodash')
const {feature} = require('@turf/turf')
const {distanceToPolygon} = require('../../util/geo.cjs')
const {getContour} = require('../../util/contours.cjs')

function immediate() {
  return new Promise(resolve => {
    setImmediate(() => resolve())
  })
}

async function filterOutOfCommune(context, maxDistance = 5) {
  const {codeCommune, adresses} = context

  const contour = await getContour(codeCommune)

  if (!contour) {
    return context
  }

  const filteredAdresses = await bluebird.mapSeries(adresses, async adresse => {
    if (!adresse.position) {
      return
    }

    // We don't want to block the event loop since it could break database connections
    await immediate()

    const distance = distanceToPolygon(feature(adresse.position), contour)

    if (distance > maxDistance) {
      console.log(`Position trop éloignée de la commune ${codeCommune} : ${distance.toFixed(2)} km`)
      return
    }

    return adresse
  })

  context.adresses = compact(filteredAdresses)
}

module.exports = filterOutOfCommune
