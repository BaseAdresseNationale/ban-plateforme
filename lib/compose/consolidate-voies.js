const {chain, first} = require('lodash')
const {rewriteSuffixes} = require('@etalab/adresses-util/lib/numeros')
const {createPseudoCodeVoieGenerator} = require('../pseudo-codes-voies')
const {consolidateNumero} = require('./consolidate-numero')
const {selectNomVoie, selectPosition} = require('./algorithm')

async function consolidateVoies(adressesCommuneWithGroupId) {
  const {codeCommune} = first(adressesCommuneWithGroupId)
  const pseudoCodeVoieGenerator = await createPseudoCodeVoieGenerator(codeCommune)

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
        .groupBy(a => `${a.numero}${a.suffixe ? a.suffixe.charAt(0).toLowerCase() : ''}`)
        .map(numeroAdresses => consolidateNumero(numeroAdresses, {idVoie, codeCommune}, {selectPosition}))
        .value()

      rewriteSuffixes(numeros)

      numeros.forEach(n => {
        const cleInterop = `${idVoie}_${String(n.numero).padStart(5, '0')}${n.suffixe ? `_${n.suffixe}` : ''}`.toLowerCase()
        n.id = cleInterop
        n.cleInterop = cleInterop
      })

      return {
        groupId,
        idVoie,
        nomVoie,
        sourceNomVoie,
        codeCommune,
        nomCommune,
        codeAncienneCommune,
        nomAncienneCommune,
        sources,
        numeros,
        nbNumeros: numeros.length
      }
    })
    .value()

  await pseudoCodeVoieGenerator.save()

  return voies
}

module.exports = consolidateVoies
