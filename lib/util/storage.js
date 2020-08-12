const {join} = require('path')
const {promisify} = require('util')
const zlib = require('zlib')
const {pathExists, readFile, outputFile, remove} = require('fs-extra')
const debug = require('debug')('adresse-pipeline')
const {getMostRecentCommune, getCodesMembres} = require('./cog')
const mongo = require('./mongo')

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)

async function setFile(path, data) {
  await outputFile(path, await gzip(JSON.stringify(data)))
}

async function getFile(path) {
  if (await pathExists(path)) {
    const content = await readFile(path)
    return JSON.parse(await gunzip(content))
  }
}

const DB_DIR = join(__dirname, '..', '..', 'db')

class SourceDb {
  constructor(sourceName) {
    this.sourceName = sourceName
  }

  async clear() {
    await mongo.connect()
    await mongo.db.collection('sources_adresses').deleteMany({source: this.sourceName})
  }

  async setCommune(codeCommune, adresses) {
    await mongo.connect()
    await mongo.db.collection('sources_adresses').deleteMany({source: this.sourceName, codeCommune})
    await mongo.db.collection('sources_adresses').insertMany(adresses)
  }

  async getCommune(codeCommune) {
    await mongo.connect()

    const commune = getMostRecentCommune(codeCommune)
    if (!commune) {
      debug(`Commune inconnue : ${codeCommune}`)
      return []
    }

    const codesMembres = getCodesMembres(commune)
    return mongo.db.collection('sources_adresses').find({source: this.sourceName, codeCommune: {$in: codesMembres}}).toArray()
  }
}

class CommunesDb {
  constructor(name) {
    this.directory = join(DB_DIR, name)
  }

  async clear() {
    await remove(this.directory)
  }

  async setKey(key, data) {
    await setFile(join(this.directory, `${key}.json.gz`), data)
  }

  async getKey(key) {
    return getFile(join(this.directory, `${key}.json.gz`))
  }

  async setCommune(codeCommune, data) {
    await this.setKey(codeCommune, data)
  }

  getCommune(codeCommune) {
    return this.getKey(codeCommune)
  }
}

module.exports = {SourceDb, CommunesDb}
