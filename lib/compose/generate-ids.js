function generateIds(voies, {codeCommune, pseudoCodeVoieGenerator}) {
  voies.forEach(voie => {
    const {codeAncienneCommune, nomVoie, idVoieFantoir} = voie

    voie.idVoie = idVoieFantoir ||
    `${codeCommune}_${pseudoCodeVoieGenerator.getCode(nomVoie, codeAncienneCommune)}`
  })

  voies.forEach(voie => {
    voie.numeros.forEach(n => {
      const cleInterop = `${voie.idVoie}_${String(n.numero).padStart(5, '0')}${n.suffixe ? `_${n.suffixe}` : ''}`.toLowerCase()
      n.id = cleInterop
      n.cleInterop = cleInterop
    })
  })
}

module.exports = generateIds
