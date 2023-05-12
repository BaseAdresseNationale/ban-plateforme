import mongo from '../../util/mongo.cjs'

const COLLECTION_DISTRICT = 'district_test'

export async function getDistrict(disrtrictID) {
  return mongo.db.collection(COLLECTION_DISTRICT).findOne({id: disrtrictID})
}

export async function getDistricts(disrtrictIDs) {
  return mongo.db.collection(COLLECTION_DISTRICT).find({id: {$in: disrtrictIDs}}).toArray()
}

export async function setDistricts(disrtricts) {
  return mongo.db.collection(COLLECTION_DISTRICT).insertMany(disrtricts)
}

export async function updateDistricts(disrtricts) {
  const bulkOperations = disrtricts.map(disrtrict => {
    const filter = {id: disrtrict.id}
    return {
      updateOne: {
        filter,
        update: {$set: disrtrict}
      }
    }
  })
  return mongo.db.collection(COLLECTION_DISTRICT).bulkWrite(bulkOperations)
}

export async function deleteDistrict(disrtrictID) {
  return mongo.db.collection(COLLECTION_DISTRICT).deleteOne({id: disrtrictID})
}

export async function deleteDistricts(disrtrictIDs) {
  return mongo.db.collection(COLLECTION_DISTRICT).deleteMany({id: {$in: disrtrictIDs}})
}
