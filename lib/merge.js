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

  const incomingAdresses = sources.map(s => {
    return readSourceData(s, codeCommune)
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
    return
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

  await writeMergeData(codeCommune, adressesCommune)
}

module.exports = async function (options, cb) {
  try {
    await main(options)
    cb()
  } catch (error) {
    console.error(error)
    cb(error)
  }
}
