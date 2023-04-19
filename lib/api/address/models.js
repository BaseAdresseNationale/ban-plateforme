import mongo from '../../util/mongo.cjs'

const COLLECTION_ADDRESS = 'address_test'

export async function getAddress(addressID) {
  return mongo.db.collection(COLLECTION_ADDRESS).findOne({id: addressID})
}

export async function getAddresses(addressIDs) {
  return mongo.db.collection(COLLECTION_ADDRESS).find({id: {$in: addressIDs}}).toArray()
}

export async function setAddresses(addresses) {
  return mongo.db.collection(COLLECTION_ADDRESS).insertMany(addresses)
}

export async function updateAddresses(addresses) {
  const bulkOperations = addresses.map(address => {
    const filter = {id: address.id}
    return {
      updateOne: {
        filter,
        update: {$set: address}
      }
    }
  })
  // TODO: Use status or historic collection for conserve event trace.
  return mongo.db.collection(COLLECTION_ADDRESS).bulkWrite(bulkOperations)
}

export async function deleteAddress(addressID) {
  return mongo.db.collection(COLLECTION_ADDRESS).deleteOne({id: addressID})
}
