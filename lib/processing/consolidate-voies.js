const {chain, first} = require('lodash')
const {rewriteSuffixes} = require('@etalab/adresses-util/lib/numeros')
const {createPseudoCodeVoieGenerator} = require('@etalab/adresses-util/lib/voies')
const {computePositionProps, computeNomVoie} = require('../customization')
const {getNomCommune} = require('../cog')
const computeGroups = require('./compute-groups')

function consolidateVoies(adressesCommune) {
  const {codeCommune} = first(adressesCommune)
  const pseudoCodeVoieGenerator = createPseudoCodeVoieGenerator()

  return chain(computeGroups(adressesCommune))
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

      /* Codes voie */

      const codesVoie = chain(adresses)
        .map('codeVoie')
        .compact()
        .uniq()
        .sort()
        .value()

      if (codesVoie.length === 0) {
        codesVoie.push(pseudoCodeVoieGenerator.create())
      }

      const codeVoie = first(codesVoie)
      const {codeAncienneCommune, nomAncienneCommune} = first(adresses)

      /* Identifiant voie */

      const idsVoie = codesVoie.map(codeVoie => `${codeCommune}-${codeVoie}`)
      const idVoie = first(idsVoie)

      const sources = chain(adresses).map('source').uniq().value()
      const nomCommune = getNomCommune(codeCommune)

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
            positions,
            position,
            positionType,
            positionSource,
            originalEntries: numeroAdresses
          }
        })
        .value()

      rewriteSuffixes(numeros)

      numeros.forEach(n => {
        n.id = `${idVoie}-${n.numero}${n.suffixe || ''}`.toUpperCase()
      })

      return {
        idVoie,
        codeVoie,
        nomVoie,
        codeCommune,
        nomCommune,
        codeAncienneCommune,
        nomAncienneCommune,
        sources,
        numeros,
        codesVoie,
        idsVoie,
        nomsVoie
      }
    })
    .value()
}

module.exports = consolidateVoies
