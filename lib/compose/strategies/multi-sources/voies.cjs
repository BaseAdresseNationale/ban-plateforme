const {chain, first, flatten} = require('lodash')
const {feature} = require('@turf/turf')
const {rewriteSuffixes} = require('@etalab/adresses-util/lib/numeros')

const {computeBufferedBbox, getCenterFromPoints, derivePositionProps} = require('../../../util/geo.cjs')
const {getCodePostalRecord} = require('../../../util/codes-postaux.cjs')
const {beautifyUppercased} = require('../../../util/string.cjs')

const generateIds = require('../../processors/generate-ids.cjs')
const computeGroups = require('../../processors/compute-groups.cjs')

const {buildNumero} = require('./numero.cjs')

function normalizeSuffixeKey(suffixe) {
  if (!suffixe) {
    return ''
  }

  return suffixe.charAt(0).toLowerCase()
}

const NOM_VOIE_PRIORITY = {
  'ign-api-gestion-municipal_administration': 6,
  'ign-api-gestion-laposte': 5,
  'ign-api-gestion-sdis': 4,
  'ign-api-gestion-ign': 3,
  cadastre: 2,
  ftth: 1,
}

function selectNomVoie(adresses) {
  const nomsVoie = chain(adresses)
    .groupBy('source')
    .mapValues((sourceAdresses => {
      const nomVoie = chain(sourceAdresses)
        .countBy('nomVoie')
        .toPairs()
        .sortBy(([, count]) => -count)
        .value()[0][0]

      const {idVoie} = sourceAdresses.find(a => a.nomVoie === nomVoie)

      return {nomVoie, idVoie}
    }))
    .value()

  return chain(nomsVoie)
    .toPairs()
    .map(([source, attrs]) => ({sourceNomVoie: source, ...attrs}))
    .maxBy(({sourceNomVoie}) => NOM_VOIE_PRIORITY[sourceNomVoie])
    .value()
}

const MULTI_SOURCES = new Set([
  'cadastre',
  'ftth',
  'ign-api-gestion-municipal_administration',
  'ign-api-gestion-sdis',
  'ign-api-gestion-ign',
  'ign-api-gestion-laposte'
])

function buildVoies(multiSourcesData, {codeCommune, pseudoCodeVoieGenerator}) {
  const adresses = flatten(multiSourcesData.map(d => d.adresses))

  const filteredAdresses = adresses.filter(a => {
    // Suppression des adresses sans numéro
    if (!a.numero) {
      return false
    }

    const numero = Number.parseInt(a.numero, 10)

    // Suppression des numéros nuls
    if (numero === 0) {
      return false
    }

    // Suppression des lignes dont la source ne correspond pas
    if (!MULTI_SOURCES.has(a.source)) {
      return false
    }

    return true
  })

  if (filteredAdresses.length === 0) {
    return []
  }

  const adressesWithGroups = computeGroups(filteredAdresses, true)

  const voies = chain(adressesWithGroups)
    .groupBy('groupId')
    .map(adresses => {
      /* Noms voie */
      const {nomVoie, idVoie: idVoieFantoir, sourceNomVoie} = selectNomVoie(adresses)

      const {codeAncienneCommune, nomAncienneCommune, nomCommune, groupId} = first(adresses)

      const sources = chain(adresses).map('source').uniq().value()

      const numeros = chain(adresses)
        .groupBy(a => `${a.numero}${normalizeSuffixeKey(a.suffixe)}`)
        .map(numeroAdresses => buildNumero(numeroAdresses, {idVoieFantoir, codeCommune}))
        .value()

      rewriteSuffixes(numeros)

      const {codePostal} = getCodePostalRecord(codeCommune, idVoieFantoir)

      const positions = numeros.filter(n => n.position).map(n => n.position)
      const centroid = getCenterFromPoints(positions)
      const {lon, lat, x, y, tiles} = derivePositionProps(centroid, 10, 14)

      return {
        groupId,
        idVoie: idVoieFantoir,
        idVoieFantoir,
        nomVoie: beautifyUppercased(nomVoie),
        sourceNomVoie,
        codeCommune,
        nomCommune,
        codeAncienneCommune,
        nomAncienneCommune,
        codePostal,
        sources,
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
