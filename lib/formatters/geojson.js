const {feature} = require('@turf/turf')

function prepareAdresse(numero, voie) {
  return feature(numero.position, {
    id: numero.cleInterop,
    numero: numero.numero,
    suffixe: numero.suffixe,
    nomVoie: voie.nomVoie,
    codeCommune: voie.codeCommune,
    nomCommune: voie.nomCommune,
    codeAncienneCommune: voie.codeAncienneCommune,
    nomAncienneCommune: voie.nomAncienneCommune,
    sourcePosition: numero.sourcePosition,
    sourceNomVoie: voie.sourceNomVoie
  })
}

function prepareToponyme(voie) {
  return feature(voie.position, {
    id: voie.idVoie,
    type: voie.type || 'voie',
    nomVoie: voie.nomVoie,
    codeCommune: voie.codeCommune,
    nomCommune: voie.nomCommune,
    codeAncienneCommune: voie.codeAncienneCommune,
    nomAncienneCommune: voie.nomAncienneCommune,
    sourceNomVoie: voie.sourceNomVoie
  })
}

module.exports = {prepareAdresse, prepareToponyme}
