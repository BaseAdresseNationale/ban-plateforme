const {pickBy, isUndefined, isNull} = require('lodash')
const {feature} = require('@turf/turf')

function compactObject(obj) {
  return pickBy(obj, v => !isUndefined(v) && !isNull(v))
}

function replaceSourcePosition(sourcePosition) {
  switch (sourcePosition) {
    case 'ign-api-gestion-laposte':
      return 'ign-api-gestion-municipal_administration';
    case 'ign-api-gestion-sdis':
      return 'ign-api-gestion-ign';
    default:
      return sourcePosition;
  }
}

function prepareAdresse(numero, voie) {
  const sourcePosition = replaceSourcePosition(numero.sourcePosition);

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
    sourcePosition: sourcePosition,
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
