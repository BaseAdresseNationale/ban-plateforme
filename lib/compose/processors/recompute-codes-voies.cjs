const {first, memoize, chain, minBy} = require('lodash')
const {createFantoirCommune} = require('@ban-team/fantoir')
const {slugify} = require('../../util/string.cjs')

const fantoirPath = process.env.FANTOIR_PATH || 'data/fantoir.sqlite'

// Cette méthode sert à attribuer un code FANTOIR aux adresses, lorsque c'est possible
async function recomputeCodesVoies(adressesCommune, fromBal) {
  if (adressesCommune.length === 0) {
    return
  }

  const listIdVoie = new Set()
  const listLibelleIdVoie = new Set()
  const {codeCommune} = first(adressesCommune)
  const fantoirCommune = await createFantoirCommune(codeCommune, {fantoirPath})

  const slugifyMemo = memoize(slugify)

  const findVoie = memoize(
    (nomVoie, communeScope) => fantoirCommune.findVoie(nomVoie, communeScope),
    (nomVoie, communeScope) => `${communeScope || codeCommune}-${slugifyMemo(nomVoie)}`
  )

  // On créé des groupes d'adresses regroupées par commune ancienne et slug de nom de voie
  const voiesGroups = chain(adressesCommune)
    .groupBy(a => `${a.codeAncienneCommune || codeCommune}-${slugifyMemo(a.nomVoie)}`)
    // Puis on détermine la voie correspondante dans FANTOIR
    .map(adresses => {
      const adresse = adresses[0]
      const fantoir = findVoie(adresse.nomVoie, adresse.codeAncienneCommune)

      if (fantoir) {
        // Avant d'attribuer le fantoir je vérifie que le couple libellé/fantoir n'apparait pas dans le set
        const libelle = adresse.nomVoie
        const idVoie = fantoir.successeur?.replace('-', '_') || fantoir.codeCommune + '_' + fantoir.codeFantoir
        // Si le code fantoir correspond à une voie annulée sans successeur, on return les adresses dans code fantoir

        if (!fantoir.successeur && fantoir.annulee) {
          return {adresses}
        }

        if (fromBal && listIdVoie.has(idVoie) && !listLibelleIdVoie.has(libelle + idVoie)) {
          return {adresses}
        }

        listIdVoie.add(idVoie)
        listLibelleIdVoie.add(libelle + idVoie)

        for (const adresse of adresses) {
          adresse.idVoie = idVoie
        }

        return {adresses, fantoir, idVoie}
      }

      return {adresses}
    })
    .value()

  /* Plusieurs libellés/slugs peuvent donner le même résultat. On recherche donc tous les doublons de rapprochement.
   * On choisit celui qui a le score le plus faible (meilleur résultat) et on supprime le rapprochement FANTOIR
   * pour les autres */
  chain(voiesGroups)
    .filter(g => g.fantoir)
    .groupBy('idVoie')
    .filter(groups => groups.length > 1)
    .forEach(groupsWithSameIdVoie => {
      const bestScoredGroup = minBy(groupsWithSameIdVoie, g => g.fantoir.score)
      groupsWithSameIdVoie.forEach(group => {
        if (group !== bestScoredGroup) {
          group.fantoir = undefined
          group.idVoie = undefined
        }
      })
    })
    .value()

  // On affecte ensuite la valeur idVoie à toutes les adresses pertinentes
  voiesGroups.forEach(g => {
    if (g.idVoie) {
      g.adresses?.forEach(a => {
        a.idVoie = g.idVoie
      })
    }
  })
}

module.exports = recomputeCodesVoies
