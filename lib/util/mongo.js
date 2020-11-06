const {MongoClient, ObjectID} = require('mongodb')

const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost'
const MONGODB_DBNAME = process.env.MONGODB_DBNAME || 'adresse-pipeline'

class Mongo {
  async connect() {
    if (this.db) {
      return
    }

    this.client = await MongoClient.connect(MONGODB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      poolSize: 2
    })

    this.db = this.client.db(MONGODB_DBNAME)

    await this.createIndexes()
  }

  async createIndexes() {
    await this.db.collection('adresses').createIndex({codeCommune: 1})
    await this.db.collection('pseudo_codes_voies').createIndex({codeCommune: 1})
    await this.db.collection('sources_adresses').createIndex({codeCommune: 1, dataSource: 1})
  }

  async disconnect(force) {
    return this.client.close(force)
  }
}

module.exports = new Mongo()
module.exports.ObjectID = ObjectID