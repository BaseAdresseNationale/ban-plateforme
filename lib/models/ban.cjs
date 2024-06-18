const mongo = require('../util/mongo.cjs')

const defaultStatsOfDistrictsDataResult = {
  nbAdresses: 0,
  nbAdressesCertifiees: 0,
  nbCommunesCouvertes: 0,
  populationCouverte: 0,
  nbCommunesIdSocle: 0,
  nbAdressesIdSocle: 0,
}

const defaultStatsOfAddressesDataResult = {
  nbAdressesAvecBanId: 0,
  nbCommunesAvecBanId: 0,
}

async function getStatsOfDistricts(cog = []) {
  const communesCollection = mongo.db.collection('communes')
  const mongoRequestFilters = {
    ban: null,
    bal: {typeComposition: 'bal'},
    computed: {typeComposition: {$ne: 'bal'}},
  }
  const statsOfDistrictsPipelineResult = groupName => (
    {
      $group: {
        _id: `group_${groupName}`,
        nbAdresses: {$sum: '$nbNumeros'},
        nbAdressesCertifiees: {$sum: '$nbNumerosCertifies'},
        nbCommunesCouvertes: {$sum: 1},
        populationCouverte: {$sum: '$population'},
        nbCommunesIdSocle: {$sum: {
          $cond: [{$eq: ['$withBanId', true]}, 1, 0]
        }},
        nbAdressesIdSocle: {$sum: {
          $cond: [{$eq: ['$withBanId', true]}, '$nbNumeros', 0]
        }}
      }
    }
  )

  const mongoRequest = [
    ...(cog && cog.length > 0 ? [{$match: {codeCommune: {$in: cog}}}] : []),
    {
      $facet: Object.fromEntries(
        Object
          .entries(mongoRequestFilters)
          .map(([groupName, filter]) => [
            groupName, [
              ...(filter ? [{$match: filter}] : []),
              statsOfDistrictsPipelineResult(groupName)
            ]
          ])
      )
    }
  ]

  return communesCollection.aggregate(mongoRequest).toArray()
}

async function getStatsOfAddresses(cog) {
  const numerosCollection = mongo.db.collection('numeros')
  const mongoRequestFilters = {
    ban: null,
    bal: {sources: 'bal'},
    computed: {sources: {$not: {$eq: ['bal']}}},
  }

  const statsOfBanIdPipelinesResult = [
    {
      $group: {
        _id: null,
        nbAdressesAvecBanId: {$sum: 1},
        nbCommunesAvecBanId: {$addToSet: '$codeCommune'}
      }
    },
    {
      $project: {
        _id: 0,
        nbAdressesAvecBanId: '$nbAdressesAvecBanId',
        nbCommunesAvecBanId: {$size: '$nbCommunesAvecBanId'}
      }
    },
  ]

  const mongoRequest = [
    ...(cog && cog.length > 0 ? [{$match: {codeCommune: {$in: cog}}}] : []),
    {$match: {banId: {$exists: true, $ne: null}}},
    {
      $facet: Object.fromEntries(
        Object
          .entries(mongoRequestFilters)
          .map(([groupName, filter]) => [
            groupName, [
              ...(filter ? [{$match: filter}] : []),
              ...statsOfBanIdPipelinesResult,
            ]
          ])
      )
    }
  ]

  return numerosCollection.aggregate(mongoRequest).toArray()
}

async function getFullStats(codesCommune) {
  const statsByCog = getStatsOfDistricts(codesCommune)
  const statsOfNumerosCollection = getStatsOfAddresses(codesCommune)

  const [
    [{ban: banDistrictStat, bal: balDistrictStat, computed: computedDistrictStat}],
    [{ban: banBanIdStat, bal: balBanIdStat, computed: computedBanIdStat}],
  ] = await Promise.all([statsByCog, statsOfNumerosCollection])

  const ban = {
    ...defaultStatsOfDistrictsDataResult,
    ...banDistrictStat?.[0],
    ...defaultStatsOfAddressesDataResult,
    ...banBanIdStat?.[0],
  }

  const bal = {
    ...defaultStatsOfDistrictsDataResult,
    ...balDistrictStat?.[0],
    ...defaultStatsOfAddressesDataResult,
    ...balBanIdStat?.[0],
  }

  const computed = {
    ...defaultStatsOfDistrictsDataResult,
    ...computedDistrictStat?.[0],
    ...defaultStatsOfAddressesDataResult,
    ...computedBanIdStat?.[0],
  }

  const total = {
    population: ban?.populationCouverte || 0,
    nbCommunes: ban?.nbCommunesCouvertes || 0,
  }

  return {
    total,
    ban,
    bal,
    computed,
  }
}

async function computeStats() {
  const {total, ban, bal, computed} = await getFullStats()

  return {
    france: total,
    ban,
    bal,
    assemblage: computed,
  }
}

async function computeFilteredStats(codesCommune) {
  const {total, ban, bal, computed} = await getFullStats(codesCommune)

  return {
    total,
    ban,
    bal,
    assemblage: computed,
  }
}

module.exports = {computeStats, computeFilteredStats}
