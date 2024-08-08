import {readFileSync} from 'node:fs'
import {createHmac} from 'node:crypto'
import {CommonToponym, Address} from '../../util/sequelize.js'
import {convertToLegacyPositionType} from '../helper.js'
import {getCommune as getDistrictFromAdminDivision, getRegion, getDepartement as getDepartment} from '../../util/cog.cjs'

const districtsGeographicOutlineJsonURL = new URL('../../../geo.json', import.meta.url)
const districtsGeographicOutline = JSON.parse(readFileSync(districtsGeographicOutlineJsonURL))

const districtsAddressesExtraDataJsonURL = new URL(`../../../${process.env.COMMUNES_LOCAUX_ADRESSES_DATA_PATH}`, import.meta.url)
let districtsAddressesExtraData = []
try {
  districtsAddressesExtraData = JSON.parse(readFileSync(districtsAddressesExtraDataJsonURL))
} catch (error) {
  console.error('Error while reading the districts addresses extra data file', error)
}

const districtsAddressesExtraDataIndex = districtsAddressesExtraData.reduce((acc, commune) => {
  acc[commune.codeCommune] = commune
  return acc
}, {})

export const formatDistrictDataForLegacy = async (district, totalCommonToponymRecords, totalAddressRecords, transaction) => {
  const {id, meta, labels} = district
  const {insee: {cog}} = meta

  // Count the total number of "lieu-dit" common toponym used for the district legacy format
  const totalSpecifCommonToponymRecords = await CommonToponym.count({
    where: {
      districtID: id,
      meta: {
        bal: {
          isLieuDit: true
        }
      },
    },
    transaction,
  })

  // Count the total number of certified addresses used for the district legacy format
  const totalAddressCertifiedRecords = await Address.count({
    where: {districtID: id, certified: true},
    transaction,
  })

  // District data from administrative division
  const districtFromAdminDivision = getDistrictFromAdminDivision(cog)
  const {population, codesPostaux: postalCodes, type} = districtFromAdminDivision
  const department = getDepartment(districtFromAdminDivision.departement)
  const region = getRegion(districtFromAdminDivision.region)

  // Labels
  const defaultLabel = getDefaultLabel(labels)
  const legacyLabelValue = defaultLabel?.value

  // Geographic data
  const districtGeoData = districtsGeographicOutline[cog]
  const districtBbox = districtGeoData?.bbox

  let addressAnalysis
  // Address analysis
  if (districtsAddressesExtraDataIndex[cog]) {
    const totalAddressesFromDistrict = districtsAddressesExtraDataIndex[cog].nbAdressesLocaux
    const ratio = totalAddressesFromDistrict && totalAddressRecords
      ? Math.round((totalAddressRecords / totalAddressesFromDistrict) * 100)
      : undefined
    const addressesDeficit = (population < 2000 && population > 0) ? ratio < 50 : undefined
    addressAnalysis = {
      nbAdressesAttendues: totalAddressesFromDistrict,
      ratio,
      deficitAdresses: addressesDeficit
    }
  }

  return {
    banId: district?.id,
    codeCommune: cog,
    nomCommune: legacyLabelValue,
    population,
    departement: {nom: department?.nom, code: department?.code},
    region: {nom: region?.nom, code: region?.code},
    codesPostaux: postalCodes || [],
    displayBBox: districtBbox,
    typeCommune: type,
    typeComposition: 'bal',
    nbVoies: totalCommonToponymRecords - totalSpecifCommonToponymRecords,
    nbLieuxDits: totalSpecifCommonToponymRecords,
    nbNumeros: totalAddressRecords,
    nbNumerosCertifies: totalAddressCertifiedRecords,
    ...(addressAnalysis ? {analyseAdressage: addressAnalysis} : {}),
    idRevision: meta?.bal?.idRevision,
    dateRevision: meta?.bal?.dateRevision,
    composedAt: new Date(),
    withBanId: true
  }
}

export const formatCommonToponymDataForLegacy = (commonToponym, district, pseudoCodeVoieGenerator, commonToponymLegacyIDCommonToponymIDMap, commonToponymLegacyIDSet) => {
  const {labels: districtLabels, meta: {insee: {cog}}} = district
  const {id, districtID, geometry, labels, meta, updateDate, addressCount, certifiedAddressCount, bbox, addressBbox} = commonToponym

  // Labels
  // District
  const {value: districtLegacyLabelValue} = getDefaultLabel(districtLabels)

  // Common toponym
  const defaultLabel = getDefaultLabel(labels)
  const defaultLabelIsoCode = defaultLabel?.isoCode
  const legacyLabelValue = defaultLabel?.value
  const legacyComplementaryLabels = formatLegacyComplementatyLabels(labels, defaultLabelIsoCode)

  // Ids
  const codeAncienneCommune = meta?.bal?.codeAncienneCommune
  const legacyCommonToponymFantoirId = meta?.dgfip?.fantoir ? `${cog}_${meta?.dgfip?.fantoir}` : null

  const legacyCommonToponymId = getLegacyCommonToponymId(commonToponymLegacyIDSet, legacyCommonToponymFantoirId, meta, {cog, id, pseudoCodeVoieGenerator, legacyLabelValue, codeAncienneCommune})

  // Store the legacy common toponym id for each common toponym to then be able to set it on legacy addresses
  commonToponymLegacyIDCommonToponymIDMap.set(id, legacyCommonToponymId)

  // Store all the legacy common toponym id
  commonToponymLegacyIDSet.add(legacyCommonToponymId)

  // Geographic data
  const legacyPosition = {
    ...geometry,
    coordinates: [round(geometry?.coordinates?.[0]), round(geometry?.coordinates?.[1])]
  }
  const lon = legacyPosition?.coordinates?.[0]
  const lat = legacyPosition?.coordinates?.[1]
  const commonToponymBbox = formatBboxForLegacy(bbox)
  const commonToponymAddressBbox = formatBboxForLegacy(addressBbox)

  const isLieuDit = meta?.bal?.isLieuDit

  if (isLieuDit) {
    // Update Date
    const legacyUpdateDate = formatLegacyUpdateDate(updateDate)
    return {
      banId: id,
      banIdDistrict: districtID,
      type: 'lieu-dit',
      source: 'bal',
      idVoie: legacyCommonToponymId,
      nomVoie: legacyLabelValue,
      nomVoieAlt: legacyComplementaryLabels,
      codeCommune: cog,
      nomCommune: districtLegacyLabelValue,
      codeAncienneCommune,
      nomAncienneCommune: meta?.bal?.nomAncienneCommune,
      codePostal: meta?.laposte?.codePostal,
      parcelles: meta?.cadastre?.ids || [],
      lon,
      lat,
      x: meta?.geography?.x,
      y: meta?.geography?.y,
      tiles: meta?.geography?.tiles,
      position: legacyPosition,
      displayBBox: commonToponymBbox,
      dateMAJ: legacyUpdateDate
    }
  }

  return {
    banId: id,
    banIdDistrict: districtID,
    type: 'voie',
    idVoie: legacyCommonToponymId,
    idVoieFantoir: legacyCommonToponymFantoirId,
    codeCommune: cog,
    nomCommune: districtLegacyLabelValue,
    codeAncienneCommune,
    nomAncienneCommune: meta?.bal?.nomAncienneCommune,
    nomVoie: legacyLabelValue,
    nomVoieAlt: legacyComplementaryLabels,
    sourceNomVoie: 'bal',
    position: legacyPosition,
    codePostal: meta?.laposte?.codePostal,
    displayBBox: commonToponymAddressBbox,
    lon,
    lat,
    x: meta?.geography?.x,
    y: meta?.geography?.y,
    tiles: meta?.geography?.tiles,
    sources: ['bal'],
    nbNumeros: Number.parseInt(addressCount, 10),
    nbNumerosCertifies: Number.parseInt(certifiedAddressCount, 10)
  }
}

export const formatAddressDataForLegacy = (address, district, commonToponymLegacyIDCommonToponymIDMap, addressLegacyIDSet) => {
  const {meta: {insee: {cog}}} = district
  const {id, mainCommonToponymID, secondaryCommonToponymIDs, districtID, number, suffix, positions, labels, meta, updateDate, certified, bbox} = address

  // Labels
  const defaultLabel = getDefaultLabel(labels)
  const defaultLabelIsoCode = defaultLabel?.isoCode
  const legacyLabelValue = defaultLabel?.value
  const legacyComplementaryLabels = formatLegacyComplementatyLabels(labels, defaultLabelIsoCode)

  // Update Date
  const legacyUpdateDate = formatLegacyUpdateDate(updateDate)

  // Geographic data
  const legacyPositions = positions.map(position => ({position: position.geometry, positionType: convertToLegacyPositionType(position.type)}))
  const legacyPosition = legacyPositions?.[0]?.position
  const legacyPositionType = legacyPositions?.[0]?.positionType
  const [lon, lat] = formatLegacyLonLat(legacyPosition)
  const addressBbox = formatBboxForLegacy(bbox)

  // Ids
  const legacyCommonToponymId = commonToponymLegacyIDCommonToponymIDMap.get(mainCommonToponymID)
  const legacyInteropKey = getAddressLegacyInteropKey(meta, {legacyCommonToponymId, number, suffix})
  const legacyID = getAddressLegacyId(addressLegacyIDSet, legacyInteropKey)
  addressLegacyIDSet.add(legacyID)
  const banIdSecondaryCommonToponyms = secondaryCommonToponymIDs && secondaryCommonToponymIDs.length > 0 ? secondaryCommonToponymIDs : null
  const legacySuffix = suffix ? suffix : null

  return {
    id: legacyID,
    cleInterop: legacyInteropKey,
    banId: id,
    banIdDistrict: districtID,
    banIdMainCommonToponym: mainCommonToponymID,
    banIdSecondaryCommonToponyms,
    idVoie: legacyCommonToponymId,
    codeCommune: cog,
    codeAncienneCommune: meta?.bal?.codeAncienneCommune,
    nomAncienneCommune: meta?.bal?.nomAncienneCommune,
    numero: number,
    suffixe: legacySuffix,
    lieuDitComplementNom: legacyLabelValue,
    lieuDitComplementNomAlt: legacyComplementaryLabels || {},
    parcelles: meta?.cadastre?.ids || [],
    positions: legacyPositions,
    position: legacyPosition,
    positionType: legacyPositionType,
    displayBBox: addressBbox,
    lon,
    lat,
    x: meta?.geography?.x,
    y: meta?.geography?.y,
    tiles: meta?.geography?.tiles,
    sources: ['bal'],
    sourcePosition: 'bal',
    dateMAJ: legacyUpdateDate,
    certifie: certified,
    codePostal: meta?.laposte?.codePostal,
    libelleAcheminement: meta?.laposte?.libelleAcheminement,
    adressesOriginales: [address]
  }
}

// Helper for formatting bbox to legacy bbox format
const formatBboxForLegacy = bbox => {
  if (!bbox) {
    return
  }

  const {coordinates} = bbox
  const allLon = []
  const allLat = []
  coordinates[0].forEach(([lon, lat]
  ) => {
    allLon.push(Number.parseFloat(lon))
    allLat.push(Number.parseFloat(lat))
  })
  const lonMin = round(Math.min(...allLon), 4)
  const latMin = round(Math.min(...allLat), 4)
  const lonMax = round(Math.max(...allLon), 4)
  const latMax = round(Math.max(...allLat), 4)
  return [lonMin, latMin, lonMax, latMax]
}

const round = (value, precision = 6) => {
  if (!value) {
    return
  }

  return Number.parseFloat(Number.parseFloat(value).toFixed(precision))
}

const getDefaultLabel = (labels, icoCode = 'fr') => {
  if (!labels || labels.length === 0) {
    return
  }

  const label = labels.find(({isoCode}) => isoCode === icoCode)
  return label || labels[0]
}

const formatLegacyComplementatyLabels = (labels, defaultLabelIsoCode) => {
  if (!labels || labels.length === 0) {
    return
  }

  const complementaryLabels = labels?.filter(({isoCode}) => isoCode !== defaultLabelIsoCode)
  return complementaryLabels.reduce((acc, {isoCode, value}) => {
    acc[isoCode] = value
    return acc
  }, {})
}

const formatLegacyUpdateDate = date => {
  if (!date) {
    return
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0') // Adding 1 to month because it's 0-based
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatLegacyLonLat = position => {
  if (!position) {
    return
  }

  const {coordinates} = position
  const lon = round(coordinates?.[0])
  const lat = round(coordinates?.[1])
  return [lon, lat]
}

const getAddressLegacyId = (addressLegacyIDSet, legacyInteropKey, suffix = 0) => {
  if (addressLegacyIDSet.has(legacyInteropKey)) {
    return getAddressLegacyId(addressLegacyIDSet, `${legacyInteropKey}__${suffix}`, suffix++)
  }

  return `${legacyInteropKey}`
}

const getAddressLegacyInteropKey = (meta, {legacyCommonToponymId, number, suffix}) => {
  const cleInterop = meta.bal?.cleInterop
  const isValidInteropKey = checkIfCleInteropIsValid(cleInterop)
  const addressLegacyInteropKey = isValidInteropKey
    ? cleInterop
    : `${legacyCommonToponymId}_${String(number).padStart(5, '0')}${suffix ? `_${suffix}` : ''}`.toLowerCase()

  return addressLegacyInteropKey
}

const getLegacyCommonToponymId = (
  commonToponymLegacyIDSet,
  legacyCommonToponymFantoirId,
  meta,
  {cog, id, pseudoCodeVoieGenerator, legacyLabelValue, codeAncienneCommune}
) => {
  let legacyCommonToponymId
  const cleInterop = meta.bal?.cleInterop
  const isCleInteropValid = checkIfCleInteropIsValid(cleInterop)
  if (isCleInteropValid) {
    const cleInteropParts = cleInterop.split('_')
    legacyCommonToponymId = `${cleInteropParts[0]}_${cleInteropParts[1]}`
  } else {
    legacyCommonToponymId = legacyCommonToponymFantoirId
  }

  // If the legacy common toponym id is already used or not defined, we calculate a pseudo code
  if (!legacyCommonToponymId || commonToponymLegacyIDSet.has(legacyCommonToponymId)) {
    legacyCommonToponymId = `${cog}_${pseudoCodeVoieGenerator.getCode(legacyLabelValue, codeAncienneCommune)}`.toLowerCase()
    // If the pseudo code is already used, we generate a new one with a hash from the common toponym id
    if (commonToponymLegacyIDSet.has(legacyCommonToponymId)) {
      legacyCommonToponymId = `${cog}_${createHmac('sha256', 'ban').update(id).digest('hex').slice(0, 6)}`
    }
  }

  return legacyCommonToponymId
}

export const checkIfCleInteropIsValid = cleInterop => {
  if (!cleInterop) {
    return false
  }

  // https://aitf-sig-topo.github.io/voies-adresses/files/AITF_SIG_Topo_Format_Base_Adresse_Locale_v1.3.pdf
  // ● INSEE code with 5 characters
  // ● Street code: the unique street identifier provided by the national unique service,
  //   or the FANTOIR DGFiP code, consisting of 4 to 6 alphanumeric characters
  // ● Address number consisting of 5 characters, prefixed with zeros if necessary
  // ● Suffix (bis / ter / qua / qui / a / b / c...). The repetition indices “bis, ter…” will
  //   be coded with 3 characters, and others (a, b, c, a1, b2...) will be in lowercase
  //   without a fixed number of characters.
  // ● Each item is separated by an underscore “_”
  // ● Everything is in lowercase

  const cleInteropFormatRegex = /^[a-z\d]{5}_(?:[a-z\d]{4}|[a-z\d]{6})_\d{5}(_[a-z\d_]+)?$/
  if (!cleInteropFormatRegex.test(cleInterop)) {
    return false
  }

  // Check if the street code is 'xxxx' to detect the non-valid pseudo code created by "mes-adresses" service
  if (cleInterop.split('_')[1] === 'xxxx') {
    return false
  }

  return true
}
