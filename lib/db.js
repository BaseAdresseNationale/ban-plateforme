const {join} = require('path')
const {promisify} = require('util')
const zlib = require('zlib')
const {flatten, compact} = require('lodash')
const {pathExists, readFile, outputFile, remove} = require('fs-extra')
const debug = require('debug')('adresse-pipeline')
const {getMostRecentCommune, getCodesMembres} = require('./cog')

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

const DB_DIR = join(__dirname, '..', 'db')

class SourceDb {
  constructor(sourceName) {
    this.directory = join(DB_DIR, `source-${sourceName}`)
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

  async setCommune(codeCommune, adresses) {
    return this.setKey(codeCommune, adresses)
  }

  async getCommune(codeCommune) {
    const commune = getMostRecentCommune(codeCommune)
    if (!commune) {
      debug(`Commune inconnue : ${codeCommune}`)
      return []
    }

    const codesMembres = getCodesMembres(commune)
    const adresses = await Promise.all(codesMembres.map(codeMembre => this.getKey(codeMembre)))
    return flatten(compact(adresses))
  }
}

class MergeDb {
  constructor(mergeName) {
    this.directory = join(DB_DIR, `merge-${mergeName}`)
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

  async setCommune(codeCommune, adresses) {
    await this.setKey(codeCommune, adresses)
  }

  getCommune(codeCommune) {
    return this.getKey(codeCommune)
  }
}

module.exports = {SourceDb, MergeDb}
