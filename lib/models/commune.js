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

async function saveCommuneData(codeCommune, {voies, numeros}) {
  await Promise.all([
    mongo.db.collection('voies').deleteMany({codeCommune}),
    mongo.db.collection('numeros').deleteMany({codeCommune})
  ])

  if (voies && voies.length > 0) {
    await mongo.db.collection('voies').insertMany(voies, {ordered: false})
  }

  if (numeros && numeros.length > 0) {
    await mongo.db.collection('numeros').insertMany(numeros, {ordered: false})
  }
}

async function getCommuneData(codeCommune) {
  const [voies, numeros] = await Promise.all([
    mongo.db.collection('voies').find({codeCommune}).toArray(),
    mongo.db.collection('numeros').find({codeCommune}).toArray()
  ])

  return {voies, numeros}
}

module.exports = {
  askComposition,
  getAskedComposition,
  finishComposition,
  getCommune,
  saveCommuneData,
  getCommuneData
}
