const {sumBy} = require('lodash')
const mongo = require('../util/mongo.cjs')
const {getCommunes, getCommune} = require('../util/cog.cjs')

async function computeStats(codesCommune) {
  const communes = codesCommune?.length > 0
    ? codesCommune.map(code => getCommune(code))
    : getCommunes()

  const total = {
    population: sumBy(communes, 'population'),
    nbCommunes: communes.length
  }

  const mongoQuery = codesCommune?.length > 0 ? {
    codeCommune: {$in: codesCommune}
  } : {}

  // eslint-disable-next-line unicorn/no-array-callback-reference
  const communesRecords = await mongo.db.collection('communes').find(mongoQuery).toArray()
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

  // We want to keep the property "france" when we compute the metrics for all the country
  // and store the result in mongo for retro-compatibility purposes
  if (!codesCommune || codesCommune.length === 0) {
    return {france: total, ban, bal}
  }

  return {total, ban, bal}
}

module.exports = {computeStats}
