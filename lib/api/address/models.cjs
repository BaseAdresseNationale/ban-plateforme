const mongo = require('../../util/mongo.cjs')

const COLLECTION_ADDRESS = 'address_test'
const COLLECTION_JOB_STATUS = 'job_status'

async function getAddress(addressID) {
  return mongo.db.collection(COLLECTION_ADDRESS).findOne({id: addressID})
}

async function getAddresses(addressIDs) {
  return mongo.db.collection(COLLECTION_ADDRESS).find({id: {$in: addressIDs}}).toArray()
}

async function setAddresses(addresses) {
  return mongo.db.collection(COLLECTION_ADDRESS).insertMany(addresses)
}

async function getAdressJobStatus(statusID) {
  return mongo.db.collection(COLLECTION_JOB_STATUS).findOne({id: statusID})
}

async function setAddressJobStatus(statusID, content) {
  return mongo.db
    .collection(COLLECTION_JOB_STATUS)
    .insertOne({
      ...content,
      id: statusID,
      createdAt: new Date()})
}

module.exports = {
  getAddress,
  getAddresses,
  setAddresses,
  getAdressJobStatus,
  setAddressJobStatus,
}
