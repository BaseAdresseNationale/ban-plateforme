import mongo from '../../util/mongo.cjs'

const COLLECTION_ROAD = 'road_test'

export async function getRoad(roadID) {
  return mongo.db.collection(COLLECTION_ROAD).findOne({id: roadID})
}

export async function getRoads(roadIDs) {
  return mongo.db.collection(COLLECTION_ROAD).find({id: {$in: roadIDs}}).toArray()
}

export async function setRoads(roads) {
  return mongo.db.collection(COLLECTION_ROAD).insertMany(roads)
}

export async function updateRoads(roads) {
  const bulkOperations = roads.map(road => {
    const filter = {id: road.id}
    return {
      updateOne: {
        filter,
        update: {$set: road}
      }
    }
  })
  // TODO: Use status or historic collection for conserve event trace.
  return mongo.db.collection(COLLECTION_ROAD).bulkWrite(bulkOperations)
}

export async function deleteRoad(roadID) {
  return mongo.db.collection(COLLECTION_ROAD).deleteOne({id: roadID})
}
