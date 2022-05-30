const {pick, maxBy} = require('lodash')
const {feature} = require('@turf/turf')
const {computeBufferedBbox, derivePositionProps} = require('../../../util/geo')
const {getCodePostalRecord} = require('../../../util/codes-postaux')

function normalizeSuffixe(suffixe) {
  if (!suffixe) {
    return undefined
  }

  return suffixe.toLowerCase()
}

const POSITION_TYPES_PRIORITY = {
  entrée: 10,
  bâtiment: 8,
  'cage d’escalier': 7,
  logement: 6,
  'service technique': 5,
  segment: 4,
  'délivrance postale': 3,
  parcelle: 1
}

function getPositionPriority({positionType}) {
  if (!positionType) {
    return 0
  }

  return POSITION_TYPES_PRIORITY[positionType] || 0
}

function getBestPosition(positions) {
  if (positions.length === 0) {
    return {}
  }

  return maxBy(positions, p => getPositionPriority(p))
}

function buildNumero(numeroAdresses, {idVoieFantoir, codeCommune, forceCertification}) {
  const {numero, lieuDitComplementNom, parcelles, certificationCommune} = numeroAdresses[0]
  const suffixe = normalizeSuffixe(numeroAdresses[0].suffixe)

  const positions = numeroAdresses
    .filter(a => a.position)
    .map(a => pick(a, 'position', 'positionType'))

  const {position, positionType} = getBestPosition(positions)
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

module.exports = {buildNumero, getBestPosition}
