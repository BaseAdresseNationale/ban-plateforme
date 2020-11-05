const debug = require('debug')('adresse-pipeline')
const mongo = require('../util/mongo')
const {getMostRecentCommune, getCodesMembres} = require('../util/cog')

const COLLECTION_NAME = 'sources_adresses'

async function getAllByContext({dataSource, codeCommune}) {
  const commune = getMostRecentCommune(codeCommune)
  if (!commune) {
    debug(`Commune inconnue : ${codeCommune}`)
    return []
  }

  const codesMembres = getCodesMembres(commune)
  return mongo.db.collection(COLLECTION_NAME).find({dataSource, codeCommune: {$in: codesMembres}}).toArray()
}

async function overrideAllByContext({dataSource, codeCommune}, adresses) {
  await mongo.db.collection(COLLECTION_NAME).deleteMany({dataSource, codeCommune})

  if (adresses.length === 0) {
    return
  }

  await mongo.db.collection(COLLECTION_NAME).insertMany(adresses, {ordered: false})
}

async function clearBySource(dataSource) {
  await mongo.db.collection(COLLECTION_NAME).deleteMany({dataSource})
}

module.exports = {
  clearBySource,
  getAllByContext,
  overrideAllByContext
}
