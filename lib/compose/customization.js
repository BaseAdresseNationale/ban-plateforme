const {chain} = require('lodash')

const NOM_VOIE_PRIORITY = {
  bal: 9,
  'ign-api-gestion-municipal_administration': 8,
  'ign-api-gestion-laposte': 7,
  'ign-api-gestion-sdis': 6,
  'ign-api-gestion-ign': 5,
  'ban-v0': 4,
  cadastre: 3,
  ftth: 2,
  'insee-ril': 1
}

function selectNomVoie(adresses) {
  const nomsVoie = chain(adresses)
    .groupBy('source')
    .mapValues((sourceAdresses => {
      const nomVoie = chain(sourceAdresses)
        .countBy('nomVoie')
        .toPairs()
        .sortBy(([, count]) => -count)
        .value()[0][0]

      const {idVoie} = sourceAdresses.find(a => a.nomVoie === nomVoie)

      return {nomVoie, idVoie}
    }))
    .value()

  return chain(nomsVoie)
    .toPairs()
    .map(([source, attrs]) => ({sourceNomVoie: source, ...attrs}))
    .maxBy(({sourceNomVoie}) => NOM_VOIE_PRIORITY[sourceNomVoie])
    .value()
}

function computePositionProps(positions) {
  if (positions.bal) {
    return {...positions.bal, sourcePosition: 'bal'}
  }

  if (positions['ign-api-gestion-municipal_administration']) {
    return {...positions['ign-api-gestion-municipal_administration'], sourcePosition: 'ign-api-gestion-municipal_administration'}
  }

  if (positions['ign-api-gestion-laposte']) {
    return {...positions['ign-api-gestion-laposte'], sourcePosition: 'ign-api-gestion-laposte'}
  }

  if (positions['ign-api-gestion-sdis']) {
    return {...positions['ign-api-gestion-sdis'], sourcePosition: 'ign-api-gestion-sdis'}
  }

  if (positions['insee-ril']) {
    return {...positions['insee-ril'], sourcePosition: 'insee-ril'}
  }

  if (positions['ign-api-gestion-ign']) {
    return {...positions['ign-api-gestion-ign'], sourcePosition: 'ign-api-gestion-ign'}
  }

  if (positions['ban-v0']) {
    return {...positions['ban-v0'], sourcePosition: 'ban-v0'}
  }

  if (positions.cadastre && positions.cadastre.positionType === 'entrée') {
    return {...positions.cadastre, sourcePosition: 'cadastre'}
  }

  if (positions.ftth) {
    return {...positions.ftth, sourcePosition: 'ftth'}
  }

  if (positions.cadastre) {
    return {...positions.cadastre, sourcePosition: 'cadastre'} // Centre de parcelle
  }

  return {}
}

module.exports = {computePositionProps, selectNomVoie}
