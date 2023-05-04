import mongo from '../../util/mongo.cjs'

export const getCommuneRevisionID = async () => (
  mongo.db.collection('communes').find({}, {projection: {codeCommune: true, idRevision: true}}).toArray()
)
