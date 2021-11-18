const {sumBy} = require('lodash')
const communes = require('@etalab/decoupage-administratif/data/communes.json')
const mongo = require('../util/mongo')

async function computeStats() {
  const communesDeFrance = communes
    .filter(c => ['arrondissement-municipal', 'commune-actuelle'].includes(c.type))
    .filter(c => !['75056', '69123', '13055'].includes(c.code))

  const france = {
    population: sumBy(communesDeFrance, 'population'),
    nbCommunes: communesDeFrance.length
  }

  const communesRecords = await mongo.db.collection('communes').find({}).toArray()
  const banCommunesRecords = communesRecords.filter(c => c.nbNumeros > 0)

  const ban = {
    nbAdresses: sumBy(banCommunesRecords, 'nbNumeros'),
    nbAdressesCertifiees: sumBy(banCommunesRecords, 'nbNumerosCertifies'),
    nbCommunesCouvertes: banCommunesRecords.length,
    populationCouverte: sumBy(banCommunesRecords, 'population')
  }

  const balCommunesRecords = communesRecords.filter(c => c.typeComposition === 'bal')

  const bal = {
    nbAdresses: sumBy(balCommunesRecords, 'nbNumeros'),
    nbAdressesCertifiees: sumBy(balCommunesRecords, 'nbNumerosCertifies'),
    nbCommunesCouvertes: balCommunesRecords.length,
    populationCouverte: sumBy(balCommunesRecords, 'population')
  }

  return {france, ban, bal}
}

module.exports = {computeStats}