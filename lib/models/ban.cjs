const {sumBy} = require('lodash')
const mongo = require('../util/mongo.cjs')
const {getCommunes, getCommune} = require('../util/cog.cjs')

async function computeStats() {
  const communes = getCommunes()

  const france = {
    population: sumBy(communes, 'population'),
    nbCommunes: communes.length
  }

  const communesRecords = await mongo.db.collection('communes').find({}).toArray()
  const banCommunesRecords = communesRecords.filter(c => c.nbNumeros > 0)

  const ban = {
    nbAdresses: sumBy(banCommunesRecords, 'nbNumeros'),
    nbAdressesCertifiees: sumBy(banCommunesRecords, 'nbNumerosCertifies'),
    nbCommunesCouvertes: banCommunesRecords.length,
    populationCouverte: sumBy(banCommunesRecords, 'population'),
    nbCommunesAvecBanId: sumBy(banCommunesRecords, 'withBanId')
  }

  const balCommunesRecords = communesRecords.filter(c => c.typeComposition === 'bal')

  const bal = {
    nbAdresses: sumBy(balCommunesRecords, 'nbNumeros'),
    nbAdressesCertifiees: sumBy(balCommunesRecords, 'nbNumerosCertifies'),
    nbCommunesCouvertes: balCommunesRecords.length,
    populationCouverte: sumBy(balCommunesRecords, 'population'),
    nbCommunesAvecBanId: sumBy(balCommunesRecords, 'withBanId')
  }

  return {france, ban, bal}
}

async function computeFilteredStats(codesCommune) {
  const communes = codesCommune.map(code => getCommune(code))

  const total = {
    population: sumBy(communes, 'population'),
    nbCommunes: communes.length
  }

  const communesRecords = await mongo.db.collection('communes').find({
    codeCommune: {$in: codesCommune}
  }).toArray()
  const banCommunesRecords = communesRecords.filter(c => c.nbNumeros > 0)

  const ban = {
    nbAdresses: sumBy(banCommunesRecords, 'nbNumeros'),
    nbAdressesCertifiees: sumBy(banCommunesRecords, 'nbNumerosCertifies'),
    nbCommunesCouvertes: banCommunesRecords.length,
    populationCouverte: sumBy(banCommunesRecords, 'population'),
    nbCommunesAvecBanId: sumBy(banCommunesRecords, 'withBanId')
  }

  const balCommunesRecords = communesRecords.filter(c => c.typeComposition === 'bal')

  const bal = {
    nbAdresses: sumBy(balCommunesRecords, 'nbNumeros'),
    nbAdressesCertifiees: sumBy(balCommunesRecords, 'nbNumerosCertifies'),
    nbCommunesCouvertes: balCommunesRecords.length,
    populationCouverte: sumBy(balCommunesRecords, 'population'),
    nbCommunesAvecBanId: sumBy(balCommunesRecords, 'withBanId')
  }

  return {total, ban, bal}
}

module.exports = {computeStats, computeFilteredStats}
