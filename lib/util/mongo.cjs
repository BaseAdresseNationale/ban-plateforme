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
    const summary = await this.createIndexes()
    log(`Création des index — terminé (+${Date.now() - indexesStartedAt}ms) : ${summary.present} présent(s), ${summary.built} construit(s)`)

    if (summary.built > 0) {
      log('ATTENTION: des index manquaient et ont été construits au démarrage')
    }
  }

  async ensureIndex(collection, keys, options = {}) {
    const label = `${collection} ${JSON.stringify(keys)}`
    const keyStr = JSON.stringify(keys)
    const existing = await this.db.collection(collection).indexes()
    const alreadyExists = existing.some(index => JSON.stringify(index.key) === keyStr)

    if (alreadyExists) {
      log(`Index ${label} — déjà présent`)
      return 'present'
    }

    const documentCount = await this.db.collection(collection).estimatedDocumentCount()
    const startedAt = Date.now()
    log(`Index ${label} — MANQUANT (${documentCount} documents), construction en cours — peut prendre longtemps`)
    await this.db.collection(collection).createIndex(keys, options)
    log(`Index ${label} — construit (+${Date.now() - startedAt}ms)`)
    return 'built'
  }

  async createIndexes() {
    const summary = {present: 0, built: 0}
    const indexes = [
      ['voies', {codeCommune: 1}],
      ['voies', {idVoie: 1}, {unique: true}],
      ['voies', {banId: 1}],
      ['voies', {banIdDistrict: 1}],
      ['voies', {tiles: 1}],
      ['numeros', {codeCommune: 1}],
      ['numeros', {idVoie: 1}],
      ['numeros', {id: 1}, {unique: true}],
      ['numeros', {banId: 1}],
      ['numeros', {banIdMainCommonToponym: 1}],
      ['numeros', {banIdSecondaryCommonToponyms: 1}],
      ['numeros', {banIdDistrict: 1}],
      ['numeros', {tiles: 1}],
      ['numeros', {sources: 1}],
      ['pseudo_codes_voies', {codeCommune: 1}],
      ['sources_adresses', {codeCommune: 1, dataSource: 1}],
      ['sources_parts', {source: 1, part: 1}],
      ['sources_communes', {codeCommune: 1, source: 1}],
      ['sources_communes', {source: 1, part: 1}],
      ['communes', {compositionAskedAt: 1}, {sparse: true}],
      ['communes', {codeCommune: 1}],
      ['communes', {typeComposition: 1}],
      ['communes', {banId: 1}],
      ['metrics', {name: 1, date: 1}, {unique: true}],
    ]

    for (const [collection, keys, options = {}] of indexes) {
      const status = await this.ensureIndex(collection, keys, options)
      summary[status]++
    }

    return summary
  }

  async disconnect(force) {
    return this.client.close(force)
  }
}

module.exports = new Mongo()
module.exports.ObjectId = ObjectId
