const mongo = require('../util/mongo')
const compositionQueue = require('../util/queue')('compose-commune')

async function askComposition(codeCommune) {
  const now = new Date()
  await mongo.db.collection('composition_communes').findOneAndUpdate(
    {codeCommune},
    {$set: {compositionAskedAt: now}},
    {upsert: true}
  )
  await compositionQueue.add({codeCommune, compositionAskedAt: now})
}

async function finishComposition(codeCommune) {
  await mongo.db.collection('composition_communes').findOneAndUpdate(
    {codeCommune},
    {$unset: {compositionAskedAt: 1}}
  )
}

function getCommune(codeCommune) {
  return mongo.db.collection('composition_communes').findOne({codeCommune})
}

function getAskedComposition() {
  return mongo.db.collection('composition_communes').distinct('codeCommune', {compositionAskedAt: {$exists: true}})
}

module.exports = {askComposition, getAskedComposition, finishComposition, getCommune}
