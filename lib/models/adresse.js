const mongo = require('../util/mongo')

const COLLECTION_NAME = 'adresses'

async function getAllByCommune(codeCommune) {
  return mongo.db.collection(COLLECTION_NAME).find({codeCommune}).toArray()
}

async function overrideAllByCommune(codeCommune, adresses) {
  await mongo.db.collection(COLLECTION_NAME).deleteMany({codeCommune})

  if (adresses.length === 0) {
    return
  }

  await mongo.db.collection(COLLECTION_NAME).insertMany(adresses, {ordered: false})
}

module.exports = {
  getAllByCommune,
  overrideAllByCommune
}
