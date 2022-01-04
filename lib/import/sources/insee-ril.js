const {resolve} = require('path')
const {slugify} = require('@etalab/adresses-util')
const {chain} = require('lodash')
const proj = require('proj4')
const wgs84 = require('epsg-index/s/4326.json').proj4
const {parseNumero} = require('../util')
const {readCsv} = require('../../util/csv')
const getAsStream = require('../../util/get-as-stream')

function eventuallyResolve(path) {
  if (!path.startsWith('http')) {
    return resolve(path)
  }

  return path
}

const inseeRilPathPattern = process.env.INSEE_RIL_PATH_PATTERN && eventuallyResolve(process.env.INSEE_RIL_PATH_PATTERN)

function prepareData(item) {
  // Check we have 26 columns
  if (Object.keys(item).length !== 26) {
    return
  }

  const adresse = {
    dataSource: 'insee-ril',
    source: 'insee-ril',
    numero: parseNumero(item.numero),
    suffixe: item.repetition,
    nomVoie: [item.type_voie, item.libelle].filter(Boolean).join(' '),
    codeCommune: item.depcom
  }

  if (item.code_epsg && [4, 5].includes(item.code_epsg.length) && item.x && item.y) {
    const projDefinition = require(`epsg-index/s/${item.code_epsg}.json`).proj4
    const coords = [Number.parseFloat(item.x), Number.parseFloat(item.y)]

    adresse.position = {
      type: 'Point',
      coordinates: proj(projDefinition, wgs84, coords)
    }
  }

  return adresse
}

async function importData(part) {
  const inputStream = await getAsStream(inseeRilPathPattern.replace('{commune}', part))

  if (!inputStream) {
    return []
  }

  const adresses = await readCsv(
    inputStream,
    {delimiter: ';'}
  )

  return chain(adresses)
    .map(a => prepareData(a))
    .compact()
    .sortBy(adresses, a => `${a.codeCommune}-${slugify(a.nomVoie)}-${a.numero}${a.suffixe || ''}`)
    .value()
}

module.exports = importData
