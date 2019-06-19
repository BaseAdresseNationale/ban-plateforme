const {chain} = require('lodash')

const NOM_VOIE_PRIORITY = {
  bal: 5,
  'ign-api-gestion': 4,
  'ban-v0': 3,
  cadastre: 2,
  ftth: 1
}

function selectByPriority(values, priorityMap) {
  if (Object.keys(values).length === 0) {
    return
  }

  return chain(values)
    .toPairs()
    .map(([source, value]) => ({source, value}))
    .maxBy(({source}) => priorityMap[source])
    .value()
    .value
}

function computeNomVoie(nomsVoie) {
  return selectByPriority(nomsVoie, NOM_VOIE_PRIORITY)
}

function computePositionProps(positions) {
  if (positions.bal) {
    return {...positions.bal, positionSource: 'bal'}
  }

  if (positions['ign-api-gestion']) {
    return {...positions['ign-api-gestion'], positionSource: 'ign-api-gestion'}
  }

  if (positions['ban-v0']) {
    return {...positions['ban-v0'], positionSource: 'ban-v0'}
  }

  if (positions.cadastre && positions.cadastre.positionType === 'entrée') {
    return {...positions.cadastre, positionSource: 'cadastre'}
  }

  if (positions.bano) {
    return {...positions.bano, positionSource: 'bano'}
  }

  if (positions.ftth) {
    return {...positions.ftth, positionSource: 'ftth'}
  }

  if (positions.cadastre) {
    return {...positions.cadastre, positionSource: 'cadastre'} // Centre de parcelle
  }

  return {}
}

module.exports = {computePositionProps, computeNomVoie}
