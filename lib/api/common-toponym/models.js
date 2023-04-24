import mongo from '../../util/mongo.cjs'

const COLLECTION_COMMON_TOPONYM = 'commonToponym_test'

export async function getcommonToponym(commonToponymID) {
  return mongo.db.collection(COLLECTION_COMMON_TOPONYM).findOne({id: commonToponymID})
}

export async function getcommonToponyms(commonToponymIDs) {
  return mongo.db.collection(COLLECTION_COMMON_TOPONYM).find({id: {$in: commonToponymIDs}}).toArray()
}

export async function setcommonToponyms(commonToponyms) {
  return mongo.db.collection(COLLECTION_COMMON_TOPONYM).insertMany(commonToponyms)
}

export async function updatecommonToponyms(commonToponyms) {
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

export async function deletecommonToponym(commonToponymID) {
  return mongo.db.collection(COLLECTION_COMMON_TOPONYM).deleteOne({id: commonToponymID})
}
