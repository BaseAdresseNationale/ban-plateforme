const {flatten} = require('lodash')
const {SourceDb, CommunesDb} = require('./db')
const computeGroups = require('./processing/compute-groups')

async function readSourceData(sourceName, codeCommune) {
  const sourceDb = new SourceDb(sourceName)
  const adressesCommune = await sourceDb.getCommune(codeCommune)
  return require(`../sources/${sourceName}/prepare`)(adressesCommune)
}

const mergeDb = new CommunesDb('merge-default')

async function writeMergeData(codeCommune, adressesCommune) {
  await mergeDb.setCommune(codeCommune, adressesCommune)
}

async function main(options) {
  const {codeCommune, inputSources, filterSources, licences} = options
  console.time(`commune ${codeCommune}`)
  const communeStats = {codeCommune, sources: {}}

  const incomingAdresses = inputSources.map(async s => {
    const {adresses, stats} = await readSourceData(s, codeCommune)
    communeStats.sources[s] = stats
    return adresses
  })

  const flattenedAdresses = flatten(await Promise.all(incomingAdresses)).filter(a => {
    // Suppression des adresses sans numéro
    if (!a.numero) {
      return false
    }

    // Suppression des numéros nuls
    if (Number.parseInt(a.numero, 10) === 0) {
      return false
    }

    // Suppression des pseudo-numéros
    if (Number.parseInt(a.numero, 10) > 5000) {
      return false
    }

    // Suppression des lignes dont la source ne correspond pas
    if (filterSources && !filterSources.includes(a.source)) {
      return false
    }

    // Suppression des lignes dont la licence est refusée
    if (licences && !licences.includes(a.licence)) {
      return false
    }

    return true
  })

  if (flattenedAdresses.length === 0) {
    return communeStats
  }

  const adressesCommuneWithGroupId = computeGroups(flattenedAdresses)

  await writeMergeData(codeCommune, adressesCommuneWithGroupId)

  console.timeEnd(`commune ${codeCommune}`)

  return communeStats
}

module.exports = async function (options, cb) {
  try {
    const result = await main(options)
    cb(null, result)
  } catch (error) {
    console.error(error)
    cb(error)
  }
}
