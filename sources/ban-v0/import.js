const {Transform} = require('stream')
const parse = require('csv-parser')
const pumpify = require('pumpify')
const getStream = require('get-stream')
const decompress = require('decompress')
const intoStream = require('into-stream')

function prepareData(addr, enc, next) {
  const nomVoie = addr.nom_voie || addr.nom_ld
  const codeCommune = addr.code_insee

  const adresse = {
    source: 'ban-v0',
    idAdresse: addr.id,
    numero: addr.numero,
    suffixe: addr.rep,
    nomVoie,
    codeCommune,
    nomCommune: addr.nom_commune,
    codePostal: addr.code_post || undefined,
    licence: 'lgr'
  }

  if (addr.lat && addr.lon) {
    adresse.position = {
      type: 'Point',
      coordinates: [parseFloat(addr.lon), parseFloat(addr.lat)]
    }
  }

  next(null, adresse)
}

async function importData(path) {
  const files = await decompress(path)
  const csvFile = files.find(f => f.path.endsWith('csv'))
  const adresses = await getStream.array(pumpify.obj(
    intoStream(csvFile.data),
    parse({separator: ';'}),
    new Transform({objectMode: true, transform: prepareData})
  ))
  return adresses
}

module.exports = importData
