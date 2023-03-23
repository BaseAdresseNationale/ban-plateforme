const mongo = require('../util/mongo.cjs')

async function getMetric(name, date) {
  return mongo.db.collection('metrics')
    .findOne({name, date}, {projection: {_id: 0}})
}

async function getLastMetric(name) {
  return mongo.db.collection('metrics')
    .findOne({name}, {projection: {_id: 0}, sort: {date: -1}})
}

async function setMetric(name, date, value) {
  await mongo.db.collection('metrics').updateOne(
    {name, date},
    {$set: {value}},
    {upsert: true}
  )
}

module.exports = {getMetric, getLastMetric, setMetric}
