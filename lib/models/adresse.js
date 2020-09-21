const mongo = require('../util/mongo')

const COLLECTION_NAME = 'adresses'

async function getAllByCommune(codeCommune) {
  return mongo.db.collection(COLLECTION_NAME).find({codeCommune}).toArray()
}

async function overrideAllByCommune(codeCommune, adresses) {
  await mongo.db.collection(COLLECTION_NAME).deleteMany({codeCommune})
  await mongo.db.collection(COLLECTION_NAME).insertMany(adresses)
}

module.exports = {
  getAllByCommune,
  overrideAllByCommune
}
