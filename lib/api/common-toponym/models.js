import mongo from '../../util/mongo.cjs'

const COLLECTION_COMMON_TOPONYM = 'commonToponym_test'

export async function getCommonToponym(commonToponymID) {
  return mongo.db.collection(COLLECTION_COMMON_TOPONYM).findOne({id: commonToponymID})
}

export async function getCommonToponyms(commonToponymIDs) {
  return mongo.db.collection(COLLECTION_COMMON_TOPONYM).find({id: {$in: commonToponymIDs}}).toArray()
}

export async function getAllCommonToponymIDsFromCommune(codeCommune) {
  return mongo.db.collection(COLLECTION_COMMON_TOPONYM).find({codeCommune}).project({id: 1, _id: 0}).map(commonToponym => commonToponym.id).toArray()
}

export async function getAllCommonToponymIDsOutsideCommune(commontToponymIDs, codeCommune) {
  return mongo.db.collection(COLLECTION_COMMON_TOPONYM).find({id: {$in: commontToponymIDs}, codeCommune: {$ne: codeCommune}}).project({id: 1, _id: 0}).map(commonToponym => commonToponym.id).toArray()
}

export async function setCommonToponyms(commonToponyms) {
  return mongo.db.collection(COLLECTION_COMMON_TOPONYM).insertMany(commonToponyms)
}

export async function updateCommonToponyms(commonToponyms) {
  const bulkOperations = commonToponyms.map(commonToponym => {
    const filter = {id: commonToponym.id}
    return {
      updateOne: {
        filter,
        update: {$set: commonToponym}
      }
    }
  })
  // TODO: Use status or historic collection for conserve event trace.
  return mongo.db.collection(COLLECTION_COMMON_TOPONYM).bulkWrite(bulkOperations)
}

export async function deleteCommonToponym(commonToponymID) {
  return mongo.db.collection(COLLECTION_COMMON_TOPONYM).deleteOne({id: commonToponymID})
}

export async function deleteCommonToponyms(commonToponymIDs) {
  return mongo.db.collection(COLLECTION_COMMON_TOPONYM).deleteMany({id: {$in: commonToponymIDs}})
}