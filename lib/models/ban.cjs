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
    populationCouverte: sumBy(banCommunesRecords, 'population')
  }

  const balCommunesRecords = communesRecords.filter(c => c.typeComposition === 'bal')

  const bal = {
    nbAdresses: sumBy(balCommunesRecords, 'nbNumeros'),
    nbAdressesCertifiees: sumBy(balCommunesRecords, 'nbNumerosCertifies'),
    nbCommunesCouvertes: balCommunesRecords.length,
    populationCouverte: sumBy(balCommunesRecords, 'population')
  }

  return {total, ban, bal}
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
