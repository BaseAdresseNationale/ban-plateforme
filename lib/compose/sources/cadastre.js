const {feature} = require('@turf/turf')
const {chain} = require('lodash')
const recomputeCodesVoies = require('../processors/recompute-codes-voies')
const updateCommunes = require('../processors/update-communes')
const filterOutOfCommune = require('../processors/filter-out-of-commune')
const {computeBufferedBbox, derivePositionProps, getCenterFromPoints} = require('../../util/geo')
const {getCodePostalRecord} = require('../../util/codes-postaux')

const ACCEPT_DESTINATIONS = new Set([
  'maison',
  'appartement',
  'commerce',
  'port-de-plaisance',
  'site-industriel',
  'gare',
  'bureaux',
  'depot',
  'atelier-artisanal',
  'atelier-industriel',
  'chenil-vivier',
  'hotel',
  'autre-hebergement',
  'residence-hoteliere',
  'salle-de-spectacle',
  'salle-de-loisir',
  'terrain-de-camping',
  'etablissement-detente-bien-etre',
  'centre-de-loisirs',
  'ecole-privee',
  'hopital',
  'centre-medico-social-creche',
  'maison-de-retraite',
  'centre-thermal-reeducation',
  'autre-etablissement'
])

function extractLieuxDits(adressesCommune) {
  const voiesLieuxDits = chain(adressesCommune)
    .filter(a => a.idVoie)
    .groupBy('idVoie')
    .filter(adressesVoie => adressesVoie.every(a => a.numero >= 5000))
    .map(adressesVoie => {
      const {codeCommune, idVoie, nomVoie, nomCommune, codeAncienneCommune, nomAncienneCommune} = adressesVoie[0]
      const {codePostal} = getCodePostalRecord(codeCommune, idVoie)

      const position = getCenterFromPoints(
        adressesVoie.filter(a => a.position).map(a => a.position)
      )
      const {lon, lat, x, y, tiles} = derivePositionProps(position, 10, 14)

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

  return voiesLieuxDits.filter(v => v.destination.some(d => ACCEPT_DESTINATIONS.has(d)))
}

async function prepareData(adressesCommune, {codeCommune}) {
  const context = {adresses: adressesCommune, codeCommune}

  await filterOutOfCommune(context, 0.6)

  await updateCommunes(context.adresses)
  await recomputeCodesVoies(context.adresses)

  const lieuxDits = extractLieuxDits(context.adresses)

  return {
    adresses: context.adresses.filter(a => a.numero < 5000),
    lieuxDits,
    stats: {}
  }
}

module.exports = prepareData
