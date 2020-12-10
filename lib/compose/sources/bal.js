const {findCodePostal} = require('codes-postaux/full')
const {feature} = require('@turf/turf')
const {harmlessProj} = require('../../util/proj')
const {computeBufferedBbox} = require('../../util/geo')
const recomputeCodesVoies = require('../recompute-codes-voies')
const updateCommunes = require('../update-communes')

function expandPositionProps(position) {
  if (position) {
    const [lon, lat] = position.coordinates
    const [x, y] = harmlessProj([lon, lat]) || []
    return {lon, lat, x, y, position}
  }

  return {}
}

function buildLieuDit(adresse) {
  const {codeCommune, idVoie, nomVoie, nomCommune, codeAncienneCommune, nomAncienneCommune} = adresse
  const {lon, lat, x, y, position} = expandPositionProps(adresse.position)
  const codePostalResult = findCodePostal(codeCommune)

  return {
    type: 'lieu-dit',
    source: 'bal',
    idVoie,
    nomVoie,
    codeCommune,
    nomCommune,
    codeAncienneCommune,
    nomAncienneCommune,
    codePostal: codePostalResult.codePostal,
    lon,
    lat,
    x,
    y,
    position,
    displayBBox: position ? computeBufferedBbox([feature(position)], 100) : undefined
  }
}

async function prepareData(adressesCommune) {
  await updateCommunes(adressesCommune)
  await recomputeCodesVoies(adressesCommune)

  const adresses = adressesCommune
    // On ne conserve pas les numéros au dessus de 10000 (et notamment les lieux-dits 99999)
    .filter(a => Number.parseInt(a.numero, 10) < 10000)

  const lieuxDits = adressesCommune
    .filter(a => Number.parseInt(a.numero, 10) === 99999)
    .map(a => buildLieuDit(a))

  return {adresses, lieuxDits, stats: {}}
}

module.exports = prepareData
