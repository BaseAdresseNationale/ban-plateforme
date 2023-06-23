import mongo from '../../util/mongo.cjs'

const COLLECTION_DISTRICT = 'district_test'

export async function getDistrict(districtID) {
  return mongo.db.collection(COLLECTION_DISTRICT).findOne({id: districtID})
}

export async function getDistricts(districtIDs) {
  return mongo.db.collection(COLLECTION_DISTRICT).find({id: {$in: districtIDs}}).toArray()
}

export async function getDistrictsFromCog(cog) {
  return mongo.db.collection(COLLECTION_DISTRICT).find({meta: {insee: {cog}}}).toArray()
}

export async function setDistricts(districts) {
  return mongo.db.collection(COLLECTION_DISTRICT).insertMany(districts)
}

export async function updateDistricts(districts) {
  const bulkOperations = districts.map(district => {
    const filter = {id: district.id}
    return {
      updateOne: {
        filter,
        update: {$set: district}
      }
    }
  })
  return mongo.db.collection(COLLECTION_DISTRICT).bulkWrite(bulkOperations)
}

export async function deleteDistrict(districtID) {
  return mongo.db.collection(COLLECTION_DISTRICT).deleteOne({id: districtID})
}

export async function deleteDistricts(districtIDs) {
  return mongo.db.collection(COLLECTION_DISTRICT).deleteMany({id: {$in: districtIDs}})
}
