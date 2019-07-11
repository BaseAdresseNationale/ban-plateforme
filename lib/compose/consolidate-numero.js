const {chain} = require('lodash')
const proj = require('@etalab/project-legal')
const {computePositionProps} = require('./customization')

function roundCoordinate(coordinate, precision = 6) {
  return parseFloat(coordinate.toFixed(precision))
}

function expandPositionProps(position) {
  if (!position) {
    return {}
  }

  const props = {
    lon: roundCoordinate(position.coordinates[0]),
    lat: roundCoordinate(position.coordinates[1])
  }

  const projectedCoords = proj(position.coordinates)

  if (projectedCoords) {
    props.x = projectedCoords[0]
    props.y = projectedCoords[1]
  }

  return props
}

function consolidateNumero(numeroAdresses) {
  const positions = chain(numeroAdresses)
    .filter(a => a.position)
    .groupBy('source')
    .mapValues(sourceAdresses => ({
      position: sourceAdresses[0].position,
      positionType: sourceAdresses[0].positionType
    }))
    .value()

  const suffixe = numeroAdresses[0].suffixe ?
    numeroAdresses[0].suffixe.charAt(0).toLowerCase() :
    undefined

  const {position, sourcePosition, positionType} = computePositionProps(positions)
  const otherPositionProps = expandPositionProps(position)

  return {
    numero: numeroAdresses[0].numero,
    suffixe,
    sources: chain(numeroAdresses).map('source').uniq().value(),
    position,
    positionType,
    sourcePosition,
    ...otherPositionProps
  }
}

module.exports = {consolidateNumero}
