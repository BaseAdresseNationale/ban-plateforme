const {createReadStream} = require('fs')
const {Transform} = require('stream')
const {createGunzip} = require('gunzip-stream')
const pumpify = require('pumpify')
const getStream = require('get-stream')
const {parse} = require('ndjson')

function prepareData(addr, enc, next) {
  if (addr.numeroComplet.startsWith('X')) {
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
  const adresses = await getStream.array(pumpify.obj(
    createReadStream(path),
    createGunzip(),
    parse(),
    new Transform({objectMode: true, transform: prepareData})
  ))
  return adresses
}

module.exports = importData
