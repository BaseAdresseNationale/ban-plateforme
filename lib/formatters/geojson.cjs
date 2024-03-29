const {pickBy, isUndefined, isNull} = require('lodash')
const {feature} = require('@turf/turf')

function compactObject(obj) {
  return pickBy(obj, v => !isUndefined(v) && !isNull(v))
}

function prepareAdresse(numero, voie) {
  return feature(numero.position, compactObject({
    id: numero.cleInterop,
    numero: numero.numero,
    suffixe: numero.suffixe,
    nomVoie: voie.nomVoie,
    lieuDitComplementNom: numero.lieuDitComplementNom,
    parcelles: (numero.parcelles || []).join('|'),
    codeCommune: voie.codeCommune,
    nomCommune: voie.nomCommune,
    codeAncienneCommune: voie.codeAncienneCommune,
    nomAncienneCommune: voie.nomAncienneCommune,
    sourcePosition: numero.sourcePosition,
    sourceNomVoie: voie.sourceNomVoie,
    certifie: numero.certifie,
    dateMAJ: numero.dateMAJ
  }))
}

function prepareToponyme(voie) {
  return feature(voie.position, compactObject({
    id: voie.idVoie,
    type: voie.type || 'voie',
    nomVoie: voie.nomVoie,
    parcelles: (voie.parcelles || []).join('|'),
    codeCommune: voie.codeCommune,
    nomCommune: voie.nomCommune,
    codeAncienneCommune: voie.codeAncienneCommune,
    nomAncienneCommune: voie.nomAncienneCommune,
    sourceNomVoie: voie.sourceNomVoie,
    nbNumeros: voie.nbNumeros,
    dateMAJ: voie.dateMAJ
  }))
}

module.exports = {prepareAdresse, prepareToponyme}
