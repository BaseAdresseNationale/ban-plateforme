const {chain} = require('lodash')
const {feature} = require('@turf/turf')
const {harmlessProj} = require('../util/proj')
const {computeBufferedBbox} = require('../util/geo')
const {getCodePostalRecord} = require('../util/codes-postaux')

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

  const projectedCoords = harmlessProj(position.coordinates)

  if (projectedCoords) {
    props.x = projectedCoords[0]
    props.y = projectedCoords[1]
  }

  return props
}

function consolidateNumero(numeroAdresses, {idVoie, codeCommune}, {selectPosition}) {
  const positions = chain(numeroAdresses)
    .filter(a => a.position)
    .groupBy('source')
    .mapValues(sourceAdresses => ({
      position: sourceAdresses[0].position,
      positionType: sourceAdresses[0].positionType
    }))
    .value()

  const {numero} = numeroAdresses[0]

  const suffixe = numeroAdresses[0].suffixe ?
    numeroAdresses[0].suffixe.charAt(0).toLowerCase() :
    undefined

  const {position, sourcePosition, positionType} = selectPosition(positions)
  const otherPositionProps = expandPositionProps(position)

  const {codePostal, libelleAcheminement} = getCodePostalRecord(codeCommune, idVoie, numero, suffixe)

  return {
    numero,
    suffixe,
    sources: chain(numeroAdresses).map('source').uniq().value(),
    position,
    positionType,
    displayBBox: position ? computeBufferedBbox([feature(position)], 50) : undefined,
    sourcePosition,
    ...otherPositionProps,
    codePostal,
    libelleAcheminement,
    adressesOriginales: numeroAdresses
  }
}

module.exports = {consolidateNumero}
