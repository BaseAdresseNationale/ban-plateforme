const {uniq, groupBy, chain, first, flatten} = require('lodash')
const {slugify, computeAverageIntersectDistance, compareNomVoieOverlap, compareNomVoieFuzzy} = require('@etalab/adresses-util/lib/voies')

function getNomsVoie(adressesVoie) {
  return uniq(adressesVoie.map(a => a.nomVoie))
}

function computeGroups(adressesCommune) {
  const {wIdVoie, woIdVoie} = groupBy(adressesCommune, a => a.idVoie ? 'wIdVoie' : 'woIdVoie')
  const voiesFantoir = chain(wIdVoie)
    .groupBy('idVoie')
    .map((adressesVoie, idVoie) => {
      const id = `fantoir-${idVoie}`
      return {id, groupId: id, adresses: adressesVoie}
    })
    .value()
  const voiesSansFantoir = chain(woIdVoie)
    .groupBy(a => slugify(a.nomVoie))
    .map((adressesVoie, slug) => {
      const id = `slug-${slug}`
      return {id, groupId: id, adresses: adressesVoie}
    })
    .value()
  const voies = [...voiesSansFantoir, ...voiesFantoir]

  // Appariement spatial et typographique
  voiesSansFantoir.forEach(voieSansFantoir => {
    const nomVoieActuelle = first(voieSansFantoir.adresses).nomVoie // Les adresses sont groupés par nom de voie donc pas de risque ici
    const matchResult = voies
      .filter(v => v.id !== voieSansFantoir.id) // On ne compare pas une voie avec elle-même
      .map(v2 => ({voie: v2, averageIntersectDistance: computeAverageIntersectDistance(voieSansFantoir.adresses, v2.adresses)})) // Calcul de la distance moyenne
      .filter(m => m.averageIntersectDistance > -1) // On ne garde que celles qui matchent
      .filter(m => {
        const nomsVoie = getNomsVoie(m.voie.adresses)
        const result = m.averageIntersectDistance <= 0.01 ||
        (m.averageIntersectDistance <= 0.05 && nomsVoie.some(nomVoie => compareNomVoieOverlap(nomVoieActuelle, nomVoie))) ||
        nomsVoie.some(nomVoie => compareNomVoieFuzzy(nomVoieActuelle, nomVoie))
        return result
      }) // On garde si c'est très proche ou si le libellé est proche
    if (matchResult.length > 0) {
      const groupsToMerge = uniq([voieSansFantoir.groupId, ...(matchResult.map(result => result.voie.groupId))])
      voies.forEach(voie => {
        if (groupsToMerge.includes(voie.groupId)) {
          voie.groupId = groupsToMerge[0]
        }
      })
    }
  })

  return flatten(voies.map(({groupId, adresses}) => adresses.map(a => ({...a, groupId}))))
}

module.exports = computeGroups
