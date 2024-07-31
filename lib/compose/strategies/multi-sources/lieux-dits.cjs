const {v4: uuidv4} = require('uuid')

const IS_GENERATE_BANID_ON_ASSEMBLY = process.env.IS_GENERATE_BANID_ON_ASSEMBLY === 'true'

async function buildLieuxDits(sourcesData, {existingVoiesIds}) {
  const cadastreData = sourcesData.find(d => d.source === 'cadastre')

  if (cadastreData) {
    const lieuxDitsData = cadastreData.lieuxDits.filter(ld => !existingVoiesIds.has(ld.idVoie))
    return lieuxDitsData.map(ld => {
      const banId = IS_GENERATE_BANID_ON_ASSEMBLY ? uuidv4() : undefined
      return {
        banId,
        ...ld
      }
    })
  }

  return []
}

module.exports = {buildLieuxDits}
