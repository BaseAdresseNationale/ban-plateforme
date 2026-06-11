const {MongoClient, ObjectId} = require('mongodb')

const MONGODB_DBNAME = process.env.MONGODB_DBNAME || 'ban'
const MONGODB_HOST = process.env.MONGODB_HOST || 'localhost'
const {MONGODB_USER} = process.env
const {MONGODB_PASSWORD} = process.env

const MONGODB_URL = MONGODB_USER && MONGODB_PASSWORD ? `mongodb+srv://${MONGODB_USER}:${MONGODB_PASSWORD}@${MONGODB_HOST}/${MONGODB_DBNAME}?replicaSet=replicaset&tls=true&authSource=admin&readPreference=primary` : process.env.MONGODB_URL || 'mongodb://localhost'

const MONGO_CLIENT_OPTIONS = {
  serverSelectionTimeoutMS: 30_000,
  connectTimeoutMS: 30_000,
}

function log(message) {
  console.log(`[mongo] ${new Date().toISOString()} ${message}`)
}

function maskMongoUrl(url) {
  return url.replace(/:([^@/]+)@/, ':***@')
}

class Mongo {
  async connect() {
    if (this.db) {
      return
    }

    log(`Connexion à ${maskMongoUrl(MONGODB_URL)}`)
    const connectStartedAt = Date.now()

    this.client = new MongoClient(MONGODB_URL, MONGO_CLIENT_OPTIONS)
    await this.client.connect()
    log(`Client connecté (+${Date.now() - connectStartedAt}ms)`)

    this.db = this.client.db(MONGODB_DBNAME)

    const indexesStartedAt = Date.now()
    log('Création des index — début')
    await this.createIndexes()
    log(`Création des index — terminé (+${Date.now() - indexesStartedAt}ms)`)
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
