const {feature} = require('@turf/turf')
const {chain} = require('lodash')
const recomputeCodesVoies = require('../recompute-codes-voies')
const updateCommunes = require('../update-communes')
const {computeBufferedBbox, derivePositionProps, getCentroidFromPoints} = require('../../util/geo')
const {getCodePostalRecord} = require('../../util/codes-postaux')

const ACCEPT_DESTINATIONS = [
  'habitation',
  'commerce',
  'industrie',
  'tourisme'
]

function extractLieuxDits(adressesCommune) {
  const voiesLieuxDits = chain(adressesCommune)
    .filter(a => a.idVoie)
    .groupBy('idVoie')
    .filter(adressesVoie => adressesVoie.every(a => a.numero >= 5000))
    .map(adressesVoie => {
      const {codeCommune, idVoie, nomVoie, nomCommune, codeAncienneCommune, nomAncienneCommune} = adressesVoie[0]
      const {codePostal} = getCodePostalRecord(codeCommune, idVoie)

      const position = getCentroidFromPoints(
        adressesVoie.filter(a => a.position).map(a => a.position)
      )
      const {lon, lat, x, y, tiles} = derivePositionProps(position)

      return {
        type: 'lieu-dit',
        source: 'cadastre',
        idVoie,
        nomVoie,
        codeCommune,
        nomCommune,
        codeAncienneCommune,
        nomAncienneCommune,
        codePostal,
        destination: chain(adressesVoie).map('destination').flatten().uniq().value(),
        parcelles: chain(adressesVoie).map('parcelles').flatten().uniq().value(),
        lon,
        lat,
        x,
        y,
        tiles,
        position,
        positionType: 'interpolation',
        displayBBox: position ? computeBufferedBbox([feature(position)], 100) : undefined
      }
    })
    .value()

  return voiesLieuxDits.filter(v => v.destination.some(d => ACCEPT_DESTINATIONS.includes(d)))
}

async function prepareData(adressesCommune) {
  await updateCommunes(adressesCommune)
  await recomputeCodesVoies(adressesCommune)

  const lieuxDits = extractLieuxDits(adressesCommune)

  return {adresses: adressesCommune, lieuxDits, stats: {}}
}

module.exports = prepareData
