const Keyv = require('keyv')
const {flatten, compact} = require('lodash')
const {getMostRecentCommune, getCodesMembres} = require('./cog')

class SourceDb {
  constructor(sourceName) {
    this.db = new Keyv(`sqlite://db/source-${sourceName}.sqlite`, {busyTimeout: 10000})
  }

  async clear() {
    await this.db.clear()
  }

  async setCommune(codeCommune, adresses) {
    await this.db.set(codeCommune, adresses)
  }

  async getCommune(codeCommune) {
    const commune = getMostRecentCommune(codeCommune)
    const codesMembres = getCodesMembres(commune)
    const adresses = await Promise.all(codesMembres.map(codeMembre => this.db.get(codeMembre)))
    return flatten(compact(adresses))
  }
}

class MergeDb {
  constructor(mergeName) {
    this.db = new Keyv(`sqlite://db/merge-${mergeName}.sqlite`, {busyTimeout: 10000})
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
