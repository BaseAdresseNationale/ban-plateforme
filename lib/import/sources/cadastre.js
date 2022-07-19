const {Transform} = require('stream')
const {sortBy} = require('lodash')
const {createGunzip} = require('gunzip-stream')
const pumpify = require('pumpify')
const getStream = require('get-stream')
const intoStream = require('into-stream')
const {parse} = require('ndjson')
const iconv = require('iconv-lite')
const {createSourcePartUpdater} = require('../source-part-updater')

function normalizeCodeCommune(codeCommune) {
  if (codeCommune === '97127') {
    return '97801'
  }

  if (codeCommune === '97123') {
    return '97701'
  }

  return codeCommune
}

function prepareData(addr, enc, next) {
  if (addr.numeroComplet.startsWith('X') || !addr.nomVoie) {
    return next()
  }

  const adresse = {
    dataSource: 'cadastre',
    source: 'cadastre',
    idAdresse: addr.id,
    numero: addr.numero,
    suffixe: addr.suffixe,
    nomVoie: addr.nomVoie,
    codeCommune: normalizeCodeCommune(addr.codeCommune),
    nomCommune: addr.nomCommune,
    pseudoNumero: addr.pseudoNumero,
    destination: [addr.destinationPrincipale],
    parcelles: addr.codesParcelles,
    position: addr.meilleurePosition ? addr.meilleurePosition.geometry : undefined,
    positionType: addr.meilleurePosition ? addr.meilleurePosition.type : 'aucune'
  }
  next(null, adresse)
}

async function importData(part) {
  const resourcesDefinition = [
    {
      name: 'adresses',
      url: `https://adresse.data.gouv.fr/data/adresses-cadastre/latest/ndjson-full/adresses-cadastre-${part}.ndjson.gz`
    }
  ]

  const sourcePartUpdater = createSourcePartUpdater('cadastre', part, resourcesDefinition, {allowNotFound: true})
  await sourcePartUpdater.update()

  if (!sourcePartUpdater.isResourceUpdated('adresses')) {
    return
  }

  const adresses = await getStream.array(pumpify.obj(
    intoStream(sourcePartUpdater.getResourceData('adresses')),
    createGunzip(),
    iconv.decodeStream('utf8'),
    parse(),
    new Transform({objectMode: true, transform: prepareData})
  ))

  await sourcePartUpdater.save()

  return sortBy(adresses, 'idAdresse')
}

module.exports = importData
