import mongo from '../../util/mongo.cjs'

async function getCommuneRevisionID() {
  return mongo.db.collection('communes').find({}, {projection: {codeCommune: true, idRevision: true}}).toArray()
}

module.exports = {getCommuneRevisionID}
