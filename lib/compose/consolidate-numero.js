const {chain} = require('lodash')
const {feature} = require('@turf/turf')
const {computeBufferedBbox, derivePositionProps} = require('../util/geo')
const {getCodePostalRecord} = require('../util/codes-postaux')

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
  const otherPositionProps = derivePositionProps(position, 12, 14)

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
