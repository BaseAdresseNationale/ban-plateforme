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

async function computeScoringStats() {
  const toPercent = (value, total) => Math.round((value / total) * 100)

  async function getStatistics() {
    const guichetAddr = 'ign-api-gestion-ign'
    const adresseCollection = mongo.db.collection('numeros')

    // Total des documents 'adresse'
    const totalDocuments = await adresseCollection.countDocuments()

    // Nb-bal: Nombre de documents 'Adresse' avec source 'bal'
    const nbBal = await adresseCollection.countDocuments({sources: 'bal'})

    // Score-5: Nombre de documents 'Adresse' avec source 'bal', certificationCommune à true, parcelles non vides et banId non null
    const score5 = await adresseCollection.countDocuments({
      sources: 'bal',
      certificationCommune: true,
      parcelles: {$not: {$size: 0}},
      banId: {$ne: null},
    })

    // Score-4: Nombre de documents 'Adresse' avec source 'bal', certificationCommune à true ou parcelles non vides et banId non null (mais pas les deux à la fois)
    const score4 = await adresseCollection.countDocuments({
      sources: 'bal',
      $or: [
        {certificationCommune: true},
        {parcelles: {$not: {$size: 0}}, banId: {$ne: null}},
      ],
      $nor: [
        {certificationCommune: true, parcelles: {$not: {$size: 0}}, banId: {$ne: null}},
      ]
    })

    // Score-3: Nombre de documents 'Adresse' avec source 'bal', certificationCommune à false, parcelles vides et banId non null
    const score3 = await adresseCollection.countDocuments({
      sources: 'bal',
      certificationCommune: {$ne: true},
      parcelles: {$size: 0},
      banId: {$ne: null},
    })

    // Score-3-Legacy: Nombre de documents 'Adresse' avec source 'bal', certificationCommune à true ou parcelles non vides et banId à null (mais pas les deux à la fois)
    const score3Legacy = await adresseCollection.countDocuments({
      sources: 'bal',
      $or: [
        {certificationCommune: true},
        {parcelles: {$not: {$size: 0}}, banId: null}
      ],
      $nor: [
        {certificationCommune: true, parcelles: {$not: {$size: 0}}, banId: null}
      ]
    })

    // Score-2: Nombre de documents 'Adresse' avec source 'bal', certificationCommune à false, parcelles vides et banId à null
    const score2 = await adresseCollection.countDocuments({
      sources: 'bal',
      certificationCommune: {$ne: true},
      parcelles: {$size: 0},
      banId: null,
    })

    // Score-1: Nombre de documents 'Adresse' avec source 'Guichet Adresse' et 'certifie' à true
    const score1 = await adresseCollection.countDocuments({sources: guichetAddr, certifie: true})

    const score0 = totalDocuments - score1 - score2 - score3 - score4 - score5
    const score0Legacy = totalDocuments - score1 - score2 - score3Legacy - score4 - score5

    const nbBalPercent = toPercent(nbBal, totalDocuments)
    const score5Percent = toPercent(score5, totalDocuments)
    const score4Percent = toPercent(score4, totalDocuments)
    const score3Percent = toPercent(score3, totalDocuments)
    const score3LegacyPercent = toPercent(score3Legacy, totalDocuments)
    const score2Percent = toPercent(score2, totalDocuments)
    const score1Percent = toPercent(score1, totalDocuments)
    const score0Percent = 100 - score1Percent - score2Percent - score3Percent - score4Percent - score5Percent
    const score0LegacyPercent = 100 - score1Percent - score2Percent - score3LegacyPercent - score4Percent - score5Percent

    return {
      'pre-score': {
        total: totalDocuments,
        'source-bal': nbBal,
        score0: score0Legacy,
        score1,
        score2,
        score3: score3Legacy,
        score4,
        score5,
      },
      score: {
        total: totalDocuments,
        'source-bal': nbBal,
        score0,
        score1,
        score2,
        score3,
        score4,
        score5,
      },
      'pre-score-percent': {
        total: totalDocuments,
        'source-bal': nbBalPercent,
        score0: score0LegacyPercent,
        score1: score1Percent,
        score2: score2Percent,
        score3: score3LegacyPercent,
        score4: score4Percent,
        score5: score5Percent,
      },
      'score-percent': {
        total: totalDocuments,
        'source-bal': nbBalPercent,
        score0: score0Percent,
        score1: score1Percent,
        score2: score2Percent,
        score3: score3Percent,
        score4: score4Percent,
        score5: score5Percent,
      }

    }
  }

  return getStatistics()
}

module.exports = {computeStats, computeFilteredStats, computeScoringStats}
