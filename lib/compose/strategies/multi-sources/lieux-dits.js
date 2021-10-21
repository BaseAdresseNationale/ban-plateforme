async function buildLieuxDits(sourcesData, {existingVoiesIds}) {
  const cadastreData = sourcesData.find(d => d.source === 'cadastre')

  if (cadastreData) {
    return cadastreData.lieuxDits.filter(ld => !existingVoiesIds.has(ld.idVoie))
  }

  return []
}

module.exports = {buildLieuxDits}
