function selectPosition(positions) {
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

module.exports = {selectPosition}
