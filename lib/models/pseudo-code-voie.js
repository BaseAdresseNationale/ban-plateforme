const mongo = require('../util/mongo')

const COLLECTION_NAME = 'pseudo_codes_voies'

async function getAllByCommune(codeCommune) {
  return mongo.db.collection(COLLECTION_NAME).find({codeCommune}).toArray()
}

async function createMany(pseudoCodesVoies) {
  if (pseudoCodesVoies.length === 0) {
    return
  }

  return mongo.db.collection(COLLECTION_NAME).insertMany(pseudoCodesVoies)
}

module.exports = {createMany, getAllByCommune}
