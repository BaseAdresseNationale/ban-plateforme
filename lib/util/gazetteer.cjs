const {createGazetteer} = require('@ban-team/gazetteer')

const gazetteerPromise = createGazetteer({
  cacheEnabled: true,
  cacheSize: 50,
  dbPath: process.env.GAZETTEER_DB_PATH || 'data/gazetteer.sqlite'
})

module.exports = gazetteerPromise
