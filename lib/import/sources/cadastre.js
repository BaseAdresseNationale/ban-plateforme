const {Transform} = require('stream')
const {createGunzip} = require('gunzip-stream')
const pumpify = require('pumpify')
const getStream = require('get-stream')
const {parse} = require('ndjson')
const getAsStream = require('../../util/get-as-stream')

function prepareData(addr, enc, next) {
  if (addr.numeroComplet.startsWith('X') || !addr.nomVoie) {
    return next()
  }

  const adresse = {
    source: 'cadastre',
    idAdresse: addr.id,
    numero: addr.numero,
    suffixe: addr.suffixe,
    nomVoie: addr.nomVoie,
    codeCommune: addr.codeCommune,
    nomCommune: addr.nomCommune,
    pseudoNumero: addr.pseudoNumero,
    destination: [addr.destinationPrincipale],
    parcelles: addr.codesParcelles,
    position: addr.meilleurePosition ? addr.meilleurePosition.geometry : undefined,
    positionType: addr.meilleurePosition ? addr.meilleurePosition.type : 'aucune',
    licence: 'lov2'
  }
  next(null, adresse)
}

async function importData(path) {
  const inputStream = await getAsStream(path)

  if (!inputStream) {
    return []
  }

  const adresses = await getStream.array(pumpify.obj(
    inputStream,
    createGunzip(),
    parse(),
    new Transform({objectMode: true, transform: prepareData})
  ))
  return adresses
}

module.exports = importData
