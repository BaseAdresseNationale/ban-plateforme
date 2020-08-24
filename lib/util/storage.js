const {join} = require('path')
const {promisify} = require('util')
const zlib = require('zlib')
const {pathExists, readFile, outputFile, remove} = require('fs-extra')

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

module.exports = {CommunesDb}
