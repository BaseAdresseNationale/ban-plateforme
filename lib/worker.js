const {callbackify} = require('util')
const {flatten, chain} = require('lodash')
const merge = require('.')

const SOURCES_LOADERS = {
  ban: require('./sources/ban'),
  bano: require('./sources/bano'),
  bal: require('./sources/bal'),
  cadastre: require('./sources/cadastre'),
  ftth: require('./sources/ftth')
}

const WRITERS = {
  geojson: require('./writers/geojson'),
  bal: require('./writers/bal'),
  ban: require('./writers/ban-v0')
}

async function main(options) {
  const {departement, sources, licences} = options
  console.log(`Préparation du département ${departement}`)

  const incomingAdresses = sources.map(s => {
    return SOURCES_LOADERS[s](options[`${s}Path`])
  })

  const flattenedAdresses = flatten(await Promise.all(incomingAdresses)).filter(a => {
    // Suppression des adresses sans numéro
    if (!a.numero) {
      return false
    }

    // Suppression des pseudo-adresses
    const parsedNumero = Number.parseInt(a.numero, 10)
    if (parsedNumero === 0 || parsedNumero > 5000) {
      return false
    }

    // Suppression des lignes dont la licence est refusée
    if (licences && !licences.includes(a.licence)) {
      return false
    }

    return true
  })

  const voies = merge(flattenedAdresses)
  const adresses = chain(voies)
    .map(voie => voie.numeros.map(n => ({
      ...voie,
      ...n
    })))
    .flatten()
    .filter(a => a.position)
    .value()

  await WRITERS.geojson(`dist/geojson/adresses-${departement}.geojson.gz`, adresses)
  await WRITERS.bal(`dist/bal/adresses-${departement}.csv.gz`, adresses)
  await WRITERS.ban(`dist/ban-v0/adresses-${departement}.csv.gz`, adresses)
}

module.exports = callbackify(main)
