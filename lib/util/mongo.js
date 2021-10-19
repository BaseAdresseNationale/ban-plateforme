const {MongoClient, ObjectId} = require('mongodb')

const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost'
const MONGODB_DBNAME = process.env.MONGODB_DBNAME || 'ban'

class Mongo {
  async connect() {
    if (this.db) {
      return
    }

    this.client = new MongoClient(MONGODB_URL)
    await this.client.connect()

    this.db = this.client.db(MONGODB_DBNAME)

    await this.createIndexes()
  }

  async createIndexes() {
    await this.db.collection('voies').createIndex({codeCommune: 1})
    await this.db.collection('voies').createIndex({idVoie: 1})
    await this.db.collection('voies').createIndex({tiles: 1})
    await this.db.collection('numeros').createIndex({codeCommune: 1})
    await this.db.collection('numeros').createIndex({idVoie: 1})
    await this.db.collection('numeros').createIndex({id: 1})
    await this.db.collection('numeros').createIndex({tiles: 1})
    await this.db.collection('pseudo_codes_voies').createIndex({codeCommune: 1})
    await this.db.collection('sources_adresses').createIndex({codeCommune: 1, dataSource: 1})
    await this.db.collection('sources_parts').createIndex({source: 1, part: 1})
    await this.db.collection('sources_communes').createIndex({codeCommune: 1, source: 1})
    await this.db.collection('sources_communes').createIndex({source: 1, part: 1})
    await this.db.collection('communes').createIndex({compositionAskedAt: 1}, {sparse: true})
    await this.db.collection('communes').createIndex({codeCommune: 1})
  }

  async disconnect(force) {
    return this.client.close(force)
  }
}

module.exports = new Mongo()
module.exports.ObjectId = ObjectId
