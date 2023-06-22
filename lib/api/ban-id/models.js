import mongo from '../../util/mongo.cjs'

const COLLECTION_ADDRESS = 'address_test'
const COLLECTION_COMMON_TOPONYM = 'common_toponym_test'
const COLLECTION_DISTRICT = 'district_test'

export async function idsInDataBase(ids) {
  return (
    await Promise.all([
      mongo.db.collection(COLLECTION_ADDRESS).find({id: {$in: ids}}).toArray(),
      mongo.db.collection(COLLECTION_COMMON_TOPONYM).find({id: {$in: ids}}).toArray(),
      mongo.db.collection(COLLECTION_DISTRICT).find({id: {$in: ids}}).toArray()
    ])
  ).flat()
}
