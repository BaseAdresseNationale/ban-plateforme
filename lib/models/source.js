const debug = require('debug')('adresse-pipeline')
const stringify = require('fast-json-stable-stringify')
const revisionHash = require('rev-hash')
const mongo = require('../util/mongo')
const {getMostRecentCommune, getCodesMembres} = require('../util/cog')
const {askComposition} = require('./commune')

function computeHash(adresses) {
  return revisionHash(stringify(adresses))
}

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

  async updateAdresses(adresses, {codeCommune, part}) {
    const revision = computeHash(adresses)
    const communeRecord = await mongo.db.collection('sources_communes').findOne({
      source: this._sourceName, codeCommune, part
    })

    if (communeRecord && communeRecord.revision === revision) {
      return
    }

    await mongo.db.collection('sources_adresses').deleteMany({
      dataSource: this._sourceName,
      codeCommune
    })
    await mongo.db.collection('sources_adresses').insertMany(adresses, {ordered: false})

    await mongo.db.collection('sources_communes').findOneAndUpdate(
      {source: this._sourceName, part, codeCommune},
      {$set: {updatedAt: new Date(), revision}},
      {upsert: true}
    )

    await askComposition(codeCommune)
  }

  async removeAdresses(codeCommune) {
    await mongo.db.collection('sources_adresses').deleteMany({
      dataSource: this._sourceName,
      codeCommune
    })

    await mongo.db.collection('sources_communes').deleteOne({source: this._sourceName, codeCommune})

    await askComposition(codeCommune)
  }

  getCoveredCommunes(part) {
    return mongo.db.collection('sources_communes').distinct('codeCommune', {
      source: this._sourceName,
      part
    })
  }

  getPartInfo(part) {
    return mongo.db.collection('sources_parts').findOne({
      source: this._sourceName,
      part
    })
  }

  async updatePartInfo(part, partInfo) {
    await mongo.db.collection('sources_parts').findOneAndUpdate({
      source: this._sourceName,
      part
    }, {$set: partInfo}, {upsert: true, returnOriginal: false})
  }
}

module.exports = function (sourceName) {
  return new Source(sourceName)
}
