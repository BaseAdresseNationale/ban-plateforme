const Keyv = require('keyv')
const {flatten, compact} = require('lodash')
const debug = require('debug')('adresse-pipeline')
const {getMostRecentCommune, getCodesMembres} = require('./cog')

class SourceDb {
  constructor(sourceName) {
    this.db = new Keyv('mongodb://localhost:27017/adresse-pipeline', {collection: `source-${sourceName}`})
    this.db.on('error', error => {
      console.error(error)
    })
  }

  async clear() {
    await this.db.clear()
  }

  async setCommune(codeCommune, adresses) {
    await this.db.set(codeCommune, adresses)
  }

  async getCommune(codeCommune) {
    const commune = getMostRecentCommune(codeCommune)
    if (!commune) {
      debug(`Commune inconnue : ${codeCommune}`)
      return []
    }

    const codesMembres = getCodesMembres(commune)
    const adresses = await Promise.all(codesMembres.map(codeMembre => this.db.get(codeMembre)))
    return flatten(compact(adresses))
  }
}

class MergeDb {
  constructor(mergeName) {
    this.db = new Keyv('mongodb://localhost:27017/adresse-pipeline', {collection: `merge-${mergeName}`})
    this.db.on('error', error => {
      console.error(error)
    })
  }

  async clear() {
    await this.db.clear()
  }

  async setCommune(codeCommune, adresses) {
    await this.db.set(codeCommune, adresses)
  }

  getCommune(codeCommune) {
    return this.db.get(codeCommune)
  }
}

module.exports = {SourceDb, MergeDb}
