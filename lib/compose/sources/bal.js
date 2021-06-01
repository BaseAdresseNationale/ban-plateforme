const {feature} = require('@turf/turf')
const {computeBufferedBbox, derivePositionProps} = require('../../util/geo')
const {getCodePostalRecord} = require('../../util/codes-postaux')
const recomputeCodesVoies = require('../recompute-codes-voies')
const updateCommunes = require('../update-communes')
const filterOutOfCommune = require('../filter-out-of-commune')

function buildLieuDit(adresse) {
  const {position, codeCommune, idVoie, nomVoie, nomCommune, codeAncienneCommune, nomAncienneCommune, parcelles} = adresse
  const {lon, lat, x, y, tiles} = derivePositionProps(position, 10, 14)
  const {codePostal} = getCodePostalRecord(codeCommune)

  return {
    type: 'lieu-dit',
    source: 'bal',
    idVoie,
    nomVoie,
    codeCommune,
    nomCommune,
    codeAncienneCommune,
    nomAncienneCommune,
    codePostal,
    parcelles,
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
  await recomputeCodesVoies(context.adresses)

  const adresses = context.adresses
    // On ne conserve pas les numéros au dessus de 10000 (et notamment les lieux-dits 99999)
    .filter(a => Number.parseInt(a.numero, 10) < 10000)

  const lieuxDits = adressesCommune
    .filter(a => Number.parseInt(a.numero, 10) === 99999)
    .map(a => buildLieuDit(a))

  return {adresses, lieuxDits, stats: {}}
}

module.exports = prepareData
