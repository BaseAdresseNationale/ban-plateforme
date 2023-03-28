import mongo from '../../util/mongo.cjs'

const COLLECTION_ADDRESS = 'address_test'
const COLLECTION_JOB_STATUS = 'job_status'

export async function getAddress(addressID) {
  return mongo.db.collection(COLLECTION_ADDRESS).findOne({id: addressID})
}

export async function getAddresses(addressIDs) {
  return mongo.db.collection(COLLECTION_ADDRESS).find({id: {$in: addressIDs}}).toArray()
}

export async function setAddresses(addresses) {
  return mongo.db.collection(COLLECTION_ADDRESS).insertMany(addresses)
}

export async function getAdressJobStatus(statusID) {
  return mongo.db.collection(COLLECTION_JOB_STATUS).findOne({id: statusID})
}

export async function setAddressJobStatus(statusID, content) {
  return mongo.db
    .collection(COLLECTION_JOB_STATUS)
    .insertOne({
      ...content,
      id: statusID,
      createdAt: new Date()})
}
