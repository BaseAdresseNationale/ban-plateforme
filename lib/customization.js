const {chain} = require('lodash')

const NOM_VOIE_PRIORITY = {
  bal: 5,
  ban: 4,
  cadastre: 3,
  bano: 2,
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

  if (positions.ban) {
    return {...positions.ban, positionSource: 'ban'}
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
