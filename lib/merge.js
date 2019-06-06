const {flatten, chain} = require('lodash')
const {SourceDb, MergeDb} = require('./db')
const consolidateVoies = require('./processing/consolidate-voies')

async function readSourceData(sourceName, codeCommune) {
  const sourceDb = new SourceDb(sourceName)
  const adressesCommune = await sourceDb.getCommune(codeCommune)

  if (adressesCommune.length === 0) {
    return []
  }

  return require(`../sources/${sourceName}/prepare`)(adressesCommune)
}

const mergeDb = new MergeDb('default')

async function writeMergeData(codeCommune, adressesCommune) {
  await mergeDb.setCommune(codeCommune, adressesCommune)
}

async function main(options) {
  const {codeCommune, sources, licences} = options
  console.time(`commune ${codeCommune}`)
  const communeStats = {codeCommune, sources: {}, beforeConsolidate: 0, afterConsolidate: 0}

  const incomingAdresses = sources.map(async s => {
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

    // Suppression des lignes dont la licence est refusée
    if (licences && !licences.includes(a.licence)) {
      return false
    }

    return true
  })

  if (flattenedAdresses.length === 0) {
    return communeStats
  }

  const voies = consolidateVoies(flattenedAdresses)
  const adressesCommune = chain(voies)
    .map(voie => voie.numeros.map(n => ({
      ...voie,
      ...n,
      numeros: undefined
    })))
    .flatten()
    .value()

  communeStats.beforeConsolidate = flattenedAdresses.length
  communeStats.afterConsolidate = adressesCommune.length

  await writeMergeData(codeCommune, adressesCommune)

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
