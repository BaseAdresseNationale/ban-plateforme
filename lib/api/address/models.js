import mongo from '../../util/mongo.cjs'

const COLLECTION_ADDRESS = 'address_test'

export async function getAddress(addressID) {
  return mongo.db.collection(COLLECTION_ADDRESS).findOne({id: addressID})
}

export async function getAddresses(addressIDs) {
  return mongo.db.collection(COLLECTION_ADDRESS).find({id: {$in: addressIDs}}).toArray()
}

export async function getAllAddressIDsFromCommune(codeCommune) {
  return mongo.db.collection(COLLECTION_ADDRESS).find({codeCommune}).project({id: 1, _id: 0}).map(address => address.id).toArray()
}

export async function getAllAddressIDsOutsideCommune(addressIDs, codeCommune) {
  return mongo.db.collection(COLLECTION_ADDRESS).find({id: {$in: addressIDs}, codeCommune: {$ne: codeCommune}}).project({id: 1, _id: 0}).map(address => address.id).toArray()
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
  return mongo.db.collection(COLLECTION_ADDRESS).bulkWrite(bulkOperations)
}

export async function deleteAddress(addressID) {
  return mongo.db.collection(COLLECTION_ADDRESS).deleteOne({id: addressID})
}

export async function deleteAddresses(addressIDs) {
  return mongo.db.collection(COLLECTION_ADDRESS).deleteMany({id: {$in: addressIDs}})
}
