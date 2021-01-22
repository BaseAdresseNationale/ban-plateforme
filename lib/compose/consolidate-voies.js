const {chain, first} = require('lodash')
const {feature} = require('@turf/turf')
const {rewriteSuffixes} = require('@etalab/adresses-util/lib/numeros')
const {computeBufferedBbox, getCenterFromPoints, derivePositionProps} = require('../util/geo')
const {getCodePostalRecord} = require('../util/codes-postaux')
const {consolidateNumero} = require('./consolidate-numero')
const {selectNomVoie, selectPosition} = require('./algorithm')

function normalizeSuffixeKey(suffixe, isBAL) {
  if (!suffixe) {
    return ''
  }

  return isBAL ? suffixe.toLowerCase() : suffixe.charAt(0).toLowerCase()
}

async function consolidateVoies(adressesCommuneWithGroupId, {pseudoCodeVoieGenerator, codeCommune}) {
  const isBAL = adressesCommuneWithGroupId.some(a => a.source === 'bal')

  const voies = chain(adressesCommuneWithGroupId)
    .groupBy('groupId')
    .map(adresses => {
      /* Noms voie */
      const {nomVoie, idVoie: idVoieFantoir, sourceNomVoie} = selectNomVoie(adresses)

      const {codeAncienneCommune, nomAncienneCommune, nomCommune, groupId} = first(adresses)

      /* Identifiant voie */
      const idVoie = idVoieFantoir ||
        `${codeCommune}_${pseudoCodeVoieGenerator.getCode(nomVoie, codeAncienneCommune)}`

      const sources = chain(adresses).map('source').uniq().value()

      const numeros = chain(adresses)
        .groupBy(a => `${a.numero}${normalizeSuffixeKey(a.suffixe, isBAL)}`)
        .map(numeroAdresses => consolidateNumero(numeroAdresses, {idVoie, codeCommune}, {selectPosition, isBAL}))
        .value()

      if (!isBAL) {
        rewriteSuffixes(numeros)
      }

      numeros.forEach(n => {
        const cleInterop = `${idVoie}_${String(n.numero).padStart(5, '0')}${n.suffixe ? `_${n.suffixe}` : ''}`.toLowerCase()
        n.id = cleInterop
        n.cleInterop = cleInterop
      })

      const {codePostal} = getCodePostalRecord(codeCommune, idVoie)

      const positions = numeros.filter(n => n.position).map(n => n.position)
      const centroid = getCenterFromPoints(positions)
      const {lon, lat, x, y, tiles} = derivePositionProps(centroid, 10, 14)

      return {
        groupId,
        idVoie,
        nomVoie,
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
        position: centroid,
        lon,
        lat,
        x,
        y,
        tiles
      }
    })
    .value()

  return voies
}

module.exports = consolidateVoies
