const {point} = require('@turf/turf')

function prepareAdresse(numero, voie) {
  return point([numero.lon, numero.lat], {
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

module.exports = {prepareAdresse}
