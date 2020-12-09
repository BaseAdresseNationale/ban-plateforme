const {findCodePostal} = require('codes-postaux/full')
const {center, feature, featureCollection, truncate} = require('@turf/turf')
const {chain} = require('lodash')
const recomputeCodesVoies = require('../recompute-codes-voies')
const updateCommunes = require('../update-communes')
const {computeBufferedBbox} = require('../../util/geo')
const {harmlessProj} = require('../../util/proj')

function buildPositionProps(adresses) {
  const positions = adresses.filter(a => a.position).map(a => a.position)

  if (positions.length > 0) {
    const centerFeature = center(featureCollection(positions.map(p => feature(p))))
    const position = truncate(centerFeature).geometry
    const [lon, lat] = position.coordinates
    const [x, y] = harmlessProj([lon, lat]) || []
    return {lon, lat, x, y, position, positionType: 'interpolation'}
  }

  return {}
}

function getCodePostal(codeCommune, idVoie, numero, suffixe) {
  if (idVoie.length === 10) {
    const [codeCommuneVoie, codeVoie] = idVoie.toUpperCase().split('_')
    return findCodePostal(codeCommuneVoie, codeVoie, numero, suffixe) || findCodePostal(codeCommuneVoie) || findCodePostal(codeCommune)
  }

  return findCodePostal(codeCommune)
}

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
      const codePostalResult = getCodePostal(codeCommune, idVoie) || {}
      const {lon, lat, x, y, position, positionType} = buildPositionProps(adressesVoie)

      return {
        type: 'lieu-dit',
        source: 'cadastre',
        idVoie,
        nomVoie,
        codeCommune,
        nomCommune,
        codeAncienneCommune,
        nomAncienneCommune,
        destination: chain(adressesVoie).map('destination').flatten().uniq().value(),
        parcelles: chain(adressesVoie).map('parcelles').flatten().uniq().value(),
        lon,
        lat,
        x,
        y,
        position,
        positionType,
        displayBBox: position ? computeBufferedBbox([feature(position)], 100) : undefined,
        ...codePostalResult
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
