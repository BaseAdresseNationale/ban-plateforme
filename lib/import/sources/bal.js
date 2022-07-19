const {slugify} = require('@etalab/adresses-util')
const {chain} = require('lodash')
const {readCsv} = require('../../util/csv')
const {createSourcePartUpdater} = require('../source-part-updater')

const codesLR = ['fra', 'bre', 'eus', 'asw', 'cos', 'gyn', 'rcf', 'oci']

function parseBoolean(value) {
  if (!value) {
    return
  }

  return value === '1'
}

function prepareData(item) {
  const adresse = {
    dataSource: 'bal',
    source: 'bal',
    idAdresse: item.id,
    originalIdVoie: item.idVoie,
    numero: Number.parseInt(item.numero, 10),
    suffixe: item.suffixe || undefined,
    nomVoie: item.nomVoie,
    lieuDitComplementNom: item.lieuDitComplementNom || undefined,
    parcelles: item.parcelles ? item.parcelles.split('|') : [],
    codeCommune: item.codeCommune,
    nomCommune: item.nomCommune,
    certificationCommune: parseBoolean(item.certificationCommune)
  }

  if (item.lon && item.lat) {
    const lon = Number.parseFloat(item.lon)
    const lat = Number.parseFloat(item.lat)

    if (lon !== 0 && lat !== 0) {
      adresse.position = {
        type: 'Point',
        coordinates: [lon, lat]
      }
      adresse.positionType = item.typePosition || undefined
    }
  }

  const nomAlt = []
  const LDCNAlt = []

  for (const code of codesLR) {
    const nomChamp = 'nomVoie_' + code
    const nomLDCN = 'lieuDitComplementNom_' + code
    if (item[nomChamp]) {
      const tempObj = {}
      tempObj[code] = item[nomChamp]
      nomAlt.push(tempObj)
    }

    if (item[nomLDCN]) {
      const tempObj = {}
      tempObj[code] = item[nomLDCN]
      LDCNAlt.push(tempObj)
    }
  }

  adresse.nomVoieAlt = undefined
  adresse.lieuDitComplementNomAlt = undefined

  if (nomAlt.length > 0) {
    adresse.nomVoieAlt = nomAlt
  }

  if (LDCNAlt.length > 0) {
    adresse.lieuDitComplementNomAlt = LDCNAlt
  }

  console.log('adresse', adresse)
  return adresse
}

function createUrl(part) {
  const BAL_URL_PATTERN = process.env.BAL_URL_PATTERN || 'https://adresse.data.gouv.fr/data/adresses-locales/latest/csv/adresses-locales-{dep}.csv.gz'
  return BAL_URL_PATTERN
    .replace('<dep>', part)
}

async function importData(part) {
  const url = createUrl(part)
  const resourcesDefinition = [
    {
      name: 'adresses',
      url
    }
  ]

  const sourcePartUpdater = createSourcePartUpdater('bal', part, resourcesDefinition, {allowNotFound: true})
  await sourcePartUpdater.update()

  if (!sourcePartUpdater.isResourceUpdated('adresses')) {
    return
  }

  const adresses = await readCsv(
    sourcePartUpdater.getResourceData('adresses'),
    {delimiter: ';'}
  )

  await sourcePartUpdater.save()

  return chain(adresses)
    .map(a => prepareData(a))
    .sortBy(a => {
      const positionId = a.position ? `${a.position.coordinates[0].toFixed(6)}/${a.position.coordinates[1].toFixed(6)}` : 'no-position'
      return `${a.codeCommune}-${slugify(a.nomVoie)}-${a.numero}${a.suffixe || ''}-${positionId}`
    })
    .value()
}

module.exports = importData
