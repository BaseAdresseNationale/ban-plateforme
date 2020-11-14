const {Transform} = require('stream')
const {createGunzip} = require('gunzip-stream')
const pumpify = require('pumpify')
const getStream = require('get-stream')
const intoStream = require('into-stream')
const {parse} = require('ndjson')
const {createSourcePartUpdater} = require('../source-part-updater')

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
    codeCommune: addr.codeCommune,
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

  const sourcePartUpdater = createSourcePartUpdater('cadastre', part, resourcesDefinition)
  await sourcePartUpdater.update()

  if (!sourcePartUpdater.isResourceUpdated('adresses')) {
    return
  }

  const adresses = await getStream.array(pumpify.obj(
    intoStream(sourcePartUpdater.getResourceData('adresses')),
    createGunzip(),
    parse(),
    new Transform({objectMode: true, transform: prepareData})
  ))

  await sourcePartUpdater.save()

  return adresses
}

module.exports = importData
