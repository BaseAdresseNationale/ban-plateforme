const {pick, maxBy, mapValues} = require('lodash')
const {feature} = require('@turf/turf')
const {computeBufferedBbox, derivePositionProps} = require('../../../util/geo.cjs')
const {getCodePostalRecord} = require('../../../util/codes-postaux.cjs')
const {beautifyUppercased} = require('../../../util/string.cjs')
const {digestIDsFromBalAddress} = require('../../../util/digest-ids-from-bal-address.cjs')
const {getBalAddressVersion} = require('../../../util/get-bal-address-version.cjs')

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
  'délivrance postale': 3,
  parcelle: 2,
  segment: 1,
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
  const balAddressVersion = getBalAddressVersion(numeroAdresses[0])
  const {addressID, mainTopoID, secondaryTopoIDs, districtID} = digestIDsFromBalAddress(numeroAdresses[0], balAddressVersion)
  const {numero, lieuDitComplementNom, lieuDitComplementNomAlt, parcelles, certificationCommune, codeAncienneCommune, nomAncienneCommune, dateMAJ} = numeroAdresses[0]
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
    banId: addressID,
    banIdMainCommonToponym: mainTopoID,
    banIdSecondaryCommonToponyms: secondaryTopoIDs,
    banIdDistrict: districtID,
    numero,
    suffixe,
    lieuDitComplementNom: lieuDitComplementNom ? beautifyUppercased(lieuDitComplementNom) : null,
    lieuDitComplementNomAlt: lieuDitComplementNomAlt ? mapValues(nom => beautifyUppercased(nom)) : {},
    parcelles: parcelles || [],
    sources: ['bal'],
    dateMAJ,
    certifie: forceCertification || certificationCommune,
    position,
    positionType,
    positions,
    displayBBox: position ? computeBufferedBbox([feature(position)], 50) : undefined,
    sourcePosition: position ? 'bal' : undefined,
    ...otherPositionProps,
    codeAncienneCommune,
    nomAncienneCommune,
    codePostal,
    libelleAcheminement,
    adressesOriginales: numeroAdresses
  }
}

module.exports = {buildNumero, getBestPosition}
