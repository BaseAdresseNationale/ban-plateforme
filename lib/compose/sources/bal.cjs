const {feature} = require('@turf/turf')
const {computeBufferedBbox, derivePositionProps} = require('../../util/geo.cjs')
const {getCodePostalRecord} = require('../../util/codes-postaux.cjs')
const recomputeCodesVoies = require('../processors/recompute-codes-voies.cjs')
const updateCommunes = require('../processors/update-communes.cjs')
const filterOutOfCommune = require('../processors/filter-out-of-commune.cjs')

function buildLieuDit(adresse) {
  const {uidAdresse, position, codeCommune, idVoie, nomVoie, nomVoieAlt, nomCommune, codeAncienneCommune, nomAncienneCommune, parcelles, dateMAJ} = adresse
  const {lon, lat, x, y, tiles} = derivePositionProps(position, 10, 14)
  const {codePostal} = getCodePostalRecord(codeCommune)

  return {
    uidAdresse,
    type: 'lieu-dit',
    source: 'bal',
    idVoie,
    nomVoie,
    nomVoieAlt,
    codeCommune,
    nomCommune,
    codeAncienneCommune,
    nomAncienneCommune,
    codePostal,
    parcelles,
    dateMAJ,
    lon,
    lat,
    x,
    y,
    tiles,
    position,
    displayBBox: position ? computeBufferedBbox([feature(position)], 100) : undefined
  }
}

async function prepareData(adressesCommune, {codeCommune}) {
  const context = {adresses: adressesCommune, codeCommune}

  await filterOutOfCommune(context)

  await updateCommunes(context.adresses)
  await recomputeCodesVoies(context.adresses, true)

  const adresses = context.adresses
    // On ne conserve pas les numéros au dessus de 10000 (et notamment les lieux-dits 99999)
    .filter(a => Number.parseInt(a.numero, 10) < 10_000)

  const lieuxDits = adressesCommune
    .filter(a => Number.parseInt(a.numero, 10) === 99_999)
    .map(a => buildLieuDit(a))

  return {adresses, lieuxDits, stats: {}}
}

module.exports = prepareData
