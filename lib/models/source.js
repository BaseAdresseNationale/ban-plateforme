const debug = require('debug')('adresse-pipeline')
const mongo = require('../util/mongo')
const {getMostRecentCommune, getCodesMembres} = require('../util/cog')

class Source {
  constructor(sourceName) {
    this._sourceName = sourceName
  }

  async getAdresses(codeCommune) {
    const commune = getMostRecentCommune(codeCommune)

    if (!commune) {
      debug(`Commune inconnue : ${codeCommune}`)
      return []
    }

    const codesMembres = getCodesMembres(commune)

    return mongo.db.collection('sources_adresses').find({
      dataSource: this._sourceName,
      codeCommune: {$in: codesMembres}
    }).toArray()
  }

  async replaceAdresses(codeCommune, adresses) {
    await mongo.db.collection('sources_adresses').deleteMany({dataSource: this._sourceName, codeCommune})

    if (adresses.length === 0) {
      return
    }

    await mongo.db.collection('sources_adresses').insertMany(adresses, {ordered: false})
  }

  async deleteAllAdresses() {
    await mongo.db.collection('sources_adresses').deleteMany({dataSource: this._sourceName})
  }
}

module.exports = function (sourceName) {
  return new Source(sourceName)
}
