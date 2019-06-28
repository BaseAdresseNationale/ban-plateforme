const {chain, first} = require('lodash')
const {rewriteSuffixes} = require('@etalab/adresses-util/lib/numeros')
const {createPseudoCodeVoieGenerator} = require('@etalab/adresses-util/lib/voies')
const {computePositionProps, computeNomVoie} = require('../customization')

function consolidateVoies(adressesCommuneWithGroupId) {
  const {codeCommune} = first(adressesCommuneWithGroupId)
  const pseudoCodeVoieGenerator = createPseudoCodeVoieGenerator()

  return chain(adressesCommuneWithGroupId)
    .groupBy('groupId')
    .map(adresses => {
      /* Noms voie */

      const nomsVoie = chain(adresses)
        .groupBy('source')
        .mapValues((sourceAdresses => {
          return chain(sourceAdresses)
            .countBy('nomVoie')
            .toPairs()
            .sortBy(([, count]) => -count)
            .value()[0][0]
        }))
        .value()

      const nomVoie = computeNomVoie(nomsVoie)

      /* Ids voie */

      const idsVoie = chain(adresses)
        .map('idVoie')
        .compact()
        .uniq()
        .sort()
        .value()

      if (idsVoie.length === 0) {
        idsVoie.push(`${codeCommune}-${pseudoCodeVoieGenerator.create()}`)
      }

      const idVoie = first(idsVoie)
      const {codeAncienneCommune, nomAncienneCommune, nomCommune} = first(adresses)

      /* Identifiant voie */

      const sources = chain(adresses).map('source').uniq().value()

      const numeros = chain(adresses)
        .groupBy(a => `${a.numero}${a.suffixe ? a.suffixe.charAt(0).toLowerCase() : ''}`)
        .map(numeroAdresses => {
          const positions = chain(numeroAdresses)
            .filter(a => a.position)
            .groupBy('source')
            .mapValues(sourceAdresses => ({
              position: sourceAdresses[0].position,
              positionType: sourceAdresses[0].positionType
            }))
            .value()

          const suffixe = numeroAdresses[0].suffixe ?
            numeroAdresses[0].suffixe.charAt(0).toLowerCase() :
            undefined

          const {position, positionSource, positionType} = computePositionProps(positions)

          return {
            numero: numeroAdresses[0].numero,
            suffixe,
            sources: chain(numeroAdresses).map('source').uniq().value(),
            position,
            positionType,
            positionSource
          }
        })
        .value()

      rewriteSuffixes(numeros)

      numeros.forEach(n => {
        const cleInterop = `${idVoie}_${String(n.numero).padStart(5, '0')}${n.suffixe ? `_${n.suffixe}` : ''}`.toLowerCase()
        n.id = cleInterop
        n.cleInterop = cleInterop
      })

      return {
        idVoie,
        nomVoie,
        codeCommune,
        nomCommune,
        codeAncienneCommune,
        nomAncienneCommune,
        sources,
        numeros,
        idsVoie,
        nomsVoie
      }
    })
    .value()
}

module.exports = consolidateVoies
