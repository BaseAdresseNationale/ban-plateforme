const debug = require('debug')('adresse-pipeline')
const mongo = require('../util/mongo')
const {getMostRecentCommune, getCodesMembres} = require('../util/cog')

const COLLECTION_NAME = 'sources_adresses'

async function getAllByContext({source, codeCommune}) {
  const commune = getMostRecentCommune(codeCommune)
  if (!commune) {
    debug(`Commune inconnue : ${codeCommune}`)
    return []
  }

  const codesMembres = getCodesMembres(commune)
  return mongo.db.collection(COLLECTION_NAME).find({source, codeCommune: {$in: codesMembres}}).toArray()
}

async function overrideAllByContext({source, codeCommune}, adresses) {
  await mongo.db.collection(COLLECTION_NAME).deleteMany({source, codeCommune})
  await mongo.db.collection(COLLECTION_NAME).insertMany(adresses)
}

async function clearBySource(source) {
  await mongo.db.collection(COLLECTION_NAME).deleteMany({source})
}

module.exports = {
  clearBySource,
  getAllByContext,
  overrideAllByContext
}
