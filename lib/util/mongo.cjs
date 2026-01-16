const {MongoClient, ObjectId} = require('mongodb')

const MONGODB_DBNAME = process.env.MONGODB_DBNAME || 'ban'
const MONGODB_HOST = process.env.MONGODB_HOST || 'localhost'
const {MONGODB_USER} = process.env
const {MONGODB_PASSWORD} = process.env

const MONGODB_URL = MONGODB_USER && MONGODB_PASSWORD ? `mongodb+srv://${MONGODB_USER}:${MONGODB_PASSWORD}@${MONGODB_HOST}/${MONGODB_DBNAME}?replicaSet=replicaset&tls=true&authSource=admin&readPreference=primary` : process.env.MONGODB_URL || 'mongodb://localhost'

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
    await this.db.collection('voies').createIndex({idVoie: 1}, {unique: true})
    await this.db.collection('voies').createIndex({banId: 1})
    await this.db.collection('voies').createIndex({banIdDistrict: 1})
    await this.db.collection('voies').createIndex({tiles: 1})
    await this.db.collection('numeros').createIndex({codeCommune: 1})
    await this.db.collection('numeros').createIndex({idVoie: 1})
    await this.db.collection('numeros').createIndex({id: 1}, {unique: true})
    await this.db.collection('numeros').createIndex({banId: 1})
    await this.db.collection('numeros').createIndex({banIdMainCommonToponym: 1})
    await this.db.collection('numeros').createIndex({banIdSecondaryCommonToponyms: 1})
    await this.db.collection('numeros').createIndex({banIdDistrict: 1})
    await this.db.collection('numeros').createIndex({tiles: 1})
    await this.db.collection('numeros').createIndex({sources: 1})
    await this.db.collection('pseudo_codes_voies').createIndex({codeCommune: 1})
    await this.db.collection('sources_adresses').createIndex({codeCommune: 1, dataSource: 1})
    await this.db.collection('sources_parts').createIndex({source: 1, part: 1})
    await this.db.collection('sources_communes').createIndex({codeCommune: 1, source: 1})
    await this.db.collection('sources_communes').createIndex({source: 1, part: 1})
    await this.db.collection('communes').createIndex({compositionAskedAt: 1}, {sparse: true})
    await this.db.collection('communes').createIndex({codeCommune: 1})
    await this.db.collection('communes').createIndex({typeComposition: 1})
    await this.db.collection('communes').createIndex({banId: 1})
    await this.db.collection('metrics').createIndex({name: 1, date: 1}, {unique: true})
  }

  async disconnect(force) {
    return this.client.close(force)
  }
}

module.exports = new Mongo()
module.exports.ObjectId = ObjectId
