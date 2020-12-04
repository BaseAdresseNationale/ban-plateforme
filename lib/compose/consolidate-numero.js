const {chain} = require('lodash')
const {findCodePostal} = require('codes-postaux/full')
const {harmlessProj} = require('../util/proj')

function getCodePostal(codeCommune, idVoie, numero, suffixe) {
  if (idVoie.length === 10) {
    const [codeCommuneVoie, codeVoie] = idVoie.toUpperCase().split('_')
    return findCodePostal(codeCommuneVoie, codeVoie, numero, suffixe) || findCodePostal(codeCommuneVoie) || findCodePostal(codeCommune)
  }

  return findCodePostal(codeCommune)
}

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

  const {codePostal, libelleAcheminement} = getCodePostal(codeCommune, idVoie, numero, suffixe) || {}

  return {
    numero,
    suffixe,
    sources: chain(numeroAdresses).map('source').uniq().value(),
    position,
    positionType,
    sourcePosition,
    ...otherPositionProps,
    codePostal,
    libelleAcheminement,
    adressesOriginales: numeroAdresses
  }
}

module.exports = {consolidateNumero, getCodePostal}
