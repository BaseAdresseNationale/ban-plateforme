const {chain} = require('lodash')
const {feature} = require('@turf/turf')
const {computeBufferedBbox, derivePositionProps} = require('../util/geo')
const {getCodePostalRecord} = require('../util/codes-postaux')

function normalizeSuffixe(suffixe, isBAL) {
  if (!suffixe) {
    return undefined
  }

  return isBAL ? suffixe.toLowerCase() : suffixe.charAt(0).toLowerCase()
}

function consolidateNumero(numeroAdresses, {idVoieFantoir, codeCommune}, {selectPosition, isBAL}) {
  const positions = chain(numeroAdresses)
    .filter(a => a.position)
    .groupBy('source')
    .mapValues(sourceAdresses => ({
      position: sourceAdresses[0].position,
      positionType: sourceAdresses[0].positionType
    }))
    .value()

  const {numero, lieuDitComplementNom, parcelles} = numeroAdresses[0]

  const suffixe = normalizeSuffixe(numeroAdresses[0].suffixe, isBAL)

  const {position, sourcePosition, positionType} = selectPosition(positions)
  const otherPositionProps = derivePositionProps(position, 12, 14)

  const {codePostal, libelleAcheminement} = getCodePostalRecord(
    codeCommune,
    idVoieFantoir,
    numero,
    suffixe ? suffixe.charAt(0) : undefined
  )

  const certifie = ['bal', 'ign-api-gestion-municipal_administration'].includes(sourcePosition)

  return {
    numero,
    suffixe,
    lieuDitComplementNom,
    parcelles: parcelles || [],
    sources: chain(numeroAdresses).map('source').uniq().value(),
    certifie,
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
