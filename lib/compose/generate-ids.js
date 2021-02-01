const {chain} = require('lodash')

function formatIdVoie(codeCommune, codeVoie) {
  return `${codeCommune}_${codeVoie}`
}

function generateIds(voies, {codeCommune, pseudoCodeVoieGenerator}) {
  voies
    .filter(voie => !voie.idVoie)
    .forEach(voie => {
      const {codeAncienneCommune, nomVoie} = voie

      voie.idVoie = formatIdVoie(
        codeCommune,
        pseudoCodeVoieGenerator.getCode(nomVoie, codeAncienneCommune)
      )
    })

  // Recherche des idVoie présents plusieurs fois
  const duplicates = chain(voies)
    .filter(v => v.idVoie.length === 12)
    .countBy('idVoie')
    .toPairs()
    .filter(([, count]) => count > 1)
    .map(([idVoie]) => idVoie)
    .value()

  /* Pour chaque idVoie présent plusieurs fois, on récupère les voies correspondantes.
   * On sélectionne ensuite la voie dont le libellé est le plus "proche" du libellé de référence.
   * Cette voie conservera l'idVoie. Toutes les autres obtiennent un nouvel idVoie. */
  duplicates.forEach(dup => {
    chain(voies)
      .filter(v => v.idVoie === dup)
      .sortBy(voie => {
        return pseudoCodeVoieGenerator.getDistance(voie.idVoie, voie.nomVoie)
      })
      .drop()
      .forEach(voie => {
        voie.idVoie = formatIdVoie(
          codeCommune,
          pseudoCodeVoieGenerator.forceCreateCode(voie.nomVoie, voie.codeAncienneCommune)
        )
      })
      .value()
  })

  voies
    .filter(v => v.numeros)
    .forEach(voie => {
      voie.numeros.forEach(n => {
        const cleInterop = `${voie.idVoie}_${String(n.numero).padStart(5, '0')}${n.suffixe ? `_${n.suffixe}` : ''}`.toLowerCase()
        n.id = cleInterop
        n.cleInterop = cleInterop
      })
    })
}

module.exports = generateIds
