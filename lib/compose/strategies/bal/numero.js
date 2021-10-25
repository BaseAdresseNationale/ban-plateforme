const {pick} = require('lodash')
const {feature} = require('@turf/turf')
const {computeBufferedBbox, derivePositionProps} = require('../../../util/geo')
const {getCodePostalRecord} = require('../../../util/codes-postaux')

function normalizeSuffixe(suffixe) {
  if (!suffixe) {
    return undefined
  }

  return suffixe.toLowerCase()
}

function buildNumero(numeroAdresses, {idVoieFantoir, codeCommune, forceCertification}) {
  const {numero, lieuDitComplementNom, parcelles, certificationCommune} = numeroAdresses[0]
  const suffixe = normalizeSuffixe(numeroAdresses[0].suffixe)

  const positions = numeroAdresses
    .filter(a => a.position)
    .map(a => pick(a, 'position', 'positionType'))

  const {position, positionType} = positions.length > 0 ? positions[0] : {}
  const otherPositionProps = derivePositionProps(position, 12, 14)

  const {codePostal, libelleAcheminement} = getCodePostalRecord(
    codeCommune,
    idVoieFantoir,
    numero,
    suffixe ? suffixe.charAt(0) : undefined
  )

  return {
    numero,
    suffixe,
    lieuDitComplementNom,
    parcelles: parcelles || [],
    sources: ['bal'],
    certifie: forceCertification || certificationCommune,
    position,
    positionType,
    positions,
    displayBBox: position ? computeBufferedBbox([feature(position)], 50) : undefined,
    sourcePosition: position ? 'bal' : undefined,
    ...otherPositionProps,
    codePostal,
    libelleAcheminement,
    adressesOriginales: numeroAdresses
  }
}

module.exports = {buildNumero}
