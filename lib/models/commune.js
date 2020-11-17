const mongo = require('../util/mongo')

async function askComposition(codeCommune) {
  await mongo.db.collection('composition_communes').findOneAndUpdate(
    {codeCommune},
    {$set: {compositionAskedAt: new Date()}},
    {upsert: true}
  )
}

function getAskedComposition() {
  return mongo.db.collection('composition_communes').distinct('codeCommune', {compositionAskedAt: {$exists: true}})
}

module.exports = {askComposition, getAskedComposition}
