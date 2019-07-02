const {chain, first} = require('lodash')
const {rewriteSuffixes} = require('@etalab/adresses-util/lib/numeros')
const {createPseudoCodeVoieGenerator} = require('../pseudo-codes-voies')
const {computePositionProps, selectNomVoie} = require('./customization')

async function consolidateVoies(adressesCommuneWithGroupId) {
  const {codeCommune} = first(adressesCommuneWithGroupId)
  const pseudoCodeVoieGenerator = await createPseudoCodeVoieGenerator(codeCommune)

  const voies = chain(adressesCommuneWithGroupId)
    .groupBy('groupId')
    .map(adresses => {
      /* Noms voie */
      const {nomVoie, idVoie: idVoieFantoir} = selectNomVoie(adresses)

      const {codeAncienneCommune, nomAncienneCommune, nomCommune} = first(adresses)

      /* Identifiant voie */
      const idVoie = idVoieFantoir ||
        `${codeCommune}_${pseudoCodeVoieGenerator.getCode(nomVoie, codeAncienneCommune)}`

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
        numeros
      }
    })
    .value()

  await pseudoCodeVoieGenerator.save()

  return voies
}

module.exports = consolidateVoies
