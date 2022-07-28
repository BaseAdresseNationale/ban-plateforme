const {chain, first, mapValues} = require('lodash')
const {feature} = require('@turf/turf')

const {computeBufferedBbox, getCenterFromPoints, derivePositionProps} = require('../../../util/geo')
const {getCodePostalRecord} = require('../../../util/codes-postaux')
const {beautifyUppercased} = require('../../../util/string')

const generateIds = require('../../processors/generate-ids')
const computeGroups = require('../../processors/compute-groups')

const {buildNumero} = require('./numero')

function normalizeSuffixeKey(suffixe) {
  if (!suffixe) {
    return ''
  }

  return suffixe.toLowerCase()
}

function buildNomVoie(adresses) {
  const nomVoie = chain(adresses)
    .countBy('nomVoie')
    .toPairs()
    .sortBy(([, count]) => -count)
    .value()[0][0]

  const {idVoie, nomVoieAlt} = adresses.find(a => a.nomVoie === nomVoie)

  return {
    nomVoie: beautifyUppercased(nomVoie),
    nomVoieAlt: nomVoieAlt ? mapValues(nomVoieAlt, nomVoie => beautifyUppercased(nomVoie)) : {},
    idVoie
  }
}

function buildVoies(balData, {codeCommune, pseudoCodeVoieGenerator, forceCertification}) {
  const adressesWithGroups = computeGroups(balData.adresses, false)

  const voies = chain(adressesWithGroups)
    .groupBy('groupId')
    .map(adresses => {
      /* Noms voie */
      const {nomVoie, nomVoieAlt, idVoie: idVoieFantoir} = buildNomVoie(adresses)

      const {codeAncienneCommune, nomAncienneCommune, nomCommune, groupId} = first(adresses)

      const numeros = chain(adresses)
        .groupBy(a => `${a.numero}${normalizeSuffixeKey(a.suffixe)}`)
        .map(numeroAdresses => buildNumero(numeroAdresses, {idVoieFantoir, codeCommune, forceCertification}))
        .value()

      const {codePostal} = getCodePostalRecord(codeCommune, idVoieFantoir)

      const positions = numeros.filter(n => n.position).map(n => n.position)
      const centroid = getCenterFromPoints(positions)
      const {lon, lat, x, y, tiles} = derivePositionProps(centroid, 10, 14)

      return {
        groupId,
        idVoie: idVoieFantoir,
        idVoieFantoir,
        nomVoie,
        nomVoieAlt,
        sourceNomVoie: 'bal',
        codeCommune,
        nomCommune,
        codeAncienneCommune,
        nomAncienneCommune,
        codePostal,
        sources: ['bal'],
        numeros,
        displayBBox: computeBufferedBbox(
          numeros.filter(n => n.position).map(n => feature(n.position)),
          200
        ),
        nbNumeros: numeros.length,
        nbNumerosCertifies: numeros.filter(n => n.certifie).length,
        position: centroid,
        lon,
        lat,
        x,
        y,
        tiles
      }
    })
    .value()

  generateIds(voies, {codeCommune, pseudoCodeVoieGenerator})

  return voies
}

module.exports = {buildVoies}
