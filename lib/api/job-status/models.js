import mongo from '../../util/mongo.cjs'

const COLLECTION_JOB_STATUS = 'job_status'

export async function getJobStatus(statusID) {
  return mongo.db.collection(COLLECTION_JOB_STATUS).findOne({id: statusID})
}

export async function getAllJobStatusOlderThanDate(date) {
  return mongo.db.collection(COLLECTION_JOB_STATUS).find({createdAt: {$lte: date}}).toArray()
}

export async function setJobStatus(statusID, content) {
  return mongo.db
    .collection(COLLECTION_JOB_STATUS)
    .insertOne({
      ...content,
      id: statusID,
      createdAt: new Date()})
}

export async function deleteJobStatus(jobStatus) {
  const bulkOperations = jobStatus.map(status => {
    const filter = {id: status.id}
    return {
      deleteOne: {
        filter
      }
    }
  })
  return mongo.db.collection(COLLECTION_JOB_STATUS).bulkWrite(bulkOperations)
}
