const {chain} = require('lodash')
const {feature} = require('@turf/turf')

const {computeBufferedBbox, derivePositionProps} = require('../../../util/geo')
const {getCodePostalRecord} = require('../../../util/codes-postaux')

function normalizeSuffixe(suffixe) {
  if (!suffixe) {
    return undefined
  }

  return suffixe.charAt(0).toLowerCase()
}

function buildCertifie({certificationCommune, sourcePosition, forceCertification}) {
  return forceCertification || certificationCommune || sourcePosition === 'ign-api-gestion-municipal_administration'
}

function selectPosition(positions) {
  if (positions['ign-api-gestion-municipal_administration']) {
    return {...positions['ign-api-gestion-municipal_administration'], sourcePosition: 'ign-api-gestion-municipal_administration'}
  }

  if (positions['ign-api-gestion-laposte']) {
    return {...positions['ign-api-gestion-laposte'], sourcePosition: 'ign-api-gestion-laposte'}
  }

  if (positions['ign-api-gestion-sdis']) {
    return {...positions['ign-api-gestion-sdis'], sourcePosition: 'ign-api-gestion-sdis'}
  }

  if (positions['insee-ril']) {
    return {...positions['insee-ril'], sourcePosition: 'insee-ril'}
  }

  if (positions['ign-api-gestion-ign']) {
    return {...positions['ign-api-gestion-ign'], sourcePosition: 'ign-api-gestion-ign'}
  }

  if (positions.cadastre && positions.cadastre.positionType === 'entrée') {
    return {...positions.cadastre, sourcePosition: 'cadastre'}
  }

  if (positions.ftth) {
    return {...positions.ftth, sourcePosition: 'ftth'}
  }

  if (positions.cadastre) {
    return {...positions.cadastre, sourcePosition: 'cadastre'} // Centre de parcelle
  }

  return {}
}

function buildNumero(numeroAdresses, {idVoieFantoir, codeCommune, forceCertification}) {
  const positions = chain(numeroAdresses)
    .filter(a => a.position)
    .groupBy('source')
    .mapValues(sourceAdresses => ({
      position: sourceAdresses[0].position,
      positionType: sourceAdresses[0].positionType
    }))
    .value()

  const {numero, lieuDitComplementNom, parcelles, certificationCommune, nomAncienneCommune, codeAncienneCommune} = numeroAdresses[0]

  const suffixe = normalizeSuffixe(numeroAdresses[0].suffixe)

  const {position, sourcePosition, positionType} = selectPosition(positions)
  const otherPositionProps = derivePositionProps(position, 12, 14)

  const {codePostal, libelleAcheminement} = getCodePostalRecord(
    codeCommune,
    idVoieFantoir,
    numero,
    suffixe ? suffixe.charAt(0) : undefined
  )

  const certifie = buildCertifie({forceCertification, certificationCommune, sourcePosition})

  return {
    numero,
    suffixe,
    lieuDitComplementNom,
    parcelles: parcelles || [],
    sources: chain(numeroAdresses).map('source').uniq().value(),
    certifie,
    position,
    positionType,
    positions: position ? [{position, positionType}] : [],
    displayBBox: position ? computeBufferedBbox([feature(position)], 50) : undefined,
    sourcePosition,
    ...otherPositionProps,
    codeAncienneCommune,
    nomAncienneCommune,
    codePostal,
    libelleAcheminement,
    adressesOriginales: numeroAdresses
  }
}

module.exports = {buildNumero}
