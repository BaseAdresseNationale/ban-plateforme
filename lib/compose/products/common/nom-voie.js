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

module.exports = {selectNomVoie}
