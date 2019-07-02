const {chain} = require('lodash')

const NOM_VOIE_PRIORITY = {
  bal: 8,
  'ign-api-gestion-municipal_administration': 7,
  'ign-api-gestion-laposte': 6,
  'ign-api-gestion-sdis': 5,
  'ign-api-gestion-ign': 4,
  'ban-v0': 3,
  cadastre: 2,
  ftth: 1
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
    .map(([source, attrs]) => ({source, attrs}))
    .maxBy(({source}) => NOM_VOIE_PRIORITY[source])
    .value()
    .attrs
}

function computePositionProps(positions) {
  if (positions.bal) {
    return {...positions.bal, positionSource: 'bal'}
  }

  if (positions['ign-api-gestion-municipal_administration']) {
    return {...positions['ign-api-gestion-municipal_administration'], positionSource: 'ign-api-gestion-municipal_administration'}
  }

  if (positions['ign-api-gestion-laposte']) {
    return {...positions['ign-api-gestion-laposte'], positionSource: 'ign-api-gestion-laposte'}
  }

  if (positions['ign-api-gestion-sdis']) {
    return {...positions['ign-api-gestion-sdis'], positionSource: 'ign-api-gestion-sdis'}
  }

  if (positions['ign-api-gestion-ign']) {
    return {...positions['ign-api-gestion-ign'], positionSource: 'ign-api-gestion-ign'}
  }

  if (positions['ban-v0']) {
    return {...positions['ban-v0'], positionSource: 'ban-v0'}
  }

  if (positions.cadastre && positions.cadastre.positionType === 'entrée') {
    return {...positions.cadastre, positionSource: 'cadastre'}
  }

  if (positions.ftth) {
    return {...positions.ftth, positionSource: 'ftth'}
  }

  if (positions.cadastre) {
    return {...positions.cadastre, positionSource: 'cadastre'} // Centre de parcelle
  }

  return {}
}

module.exports = {computePositionProps, selectNomVoie}
