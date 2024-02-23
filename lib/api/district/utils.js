import Papa from 'papaparse'
import {checkDataFormat, dataValidationReportFrom, checkIdsIsUniq, checkIdsIsVacant, checkIdsIsAvailable, checkDataShema, checkIdsShema} from '../helper.js'
import {banID} from '../schema.js'
import {getDistricts, getDistrictsFromCog} from './models.js'
import {banDistrictSchema} from './schema.js'

const getExistingDistrictIDs = async districtIDs => {
  const existingDistricts = await getDistricts(districtIDs)
  return existingDistricts.map(ditrict => ditrict.id)
}

export const checkDistrictsIDsRequest = async (districtIDs, actionType, defaultReturn = true) => {
  let report = checkDataFormat(
    `The request require an Array of district IDs but receive ${typeof districtIDs}`,
    'No district ID send to job',
    districtIDs
  ) || await checkIdsShema('Invalid IDs format', districtIDs, banID)

  if (!report) {
    switch (actionType) {
      case 'insert':
        report = (
          checkIdsIsUniq('Shared IDs in request', districtIDs)
          || await checkIdsIsVacant('Unavailable IDs', districtIDs, getExistingDistrictIDs)
        )
        break
      case 'update':
      case 'patch':
        report = (
          checkIdsIsUniq('Shared IDs in request', districtIDs)
          || await checkIdsIsAvailable('Some unknown IDs', districtIDs, getExistingDistrictIDs)
        )
        break
      case 'delete':
        report = (
          checkIdsIsUniq('Shared IDs in request', districtIDs)
          || await checkIdsIsAvailable('Some unknown IDs', districtIDs, getExistingDistrictIDs)
        )
        break
      default:
        report = dataValidationReportFrom(false, 'Unknown action type', {actionType, districtIDs})
    }
  }

  return report || (defaultReturn && dataValidationReportFrom(true)) || null
}

export const checkDistrictsRequest = async (districts, actionType) => {
  let report

  switch (actionType) {
    case 'insert':
    case 'update':
    case 'patch':
      report = checkDataFormat(
        `The request require an Array of district but receive ${typeof districts}`,
        'No district send to job',
        districts
      )
        || await checkDistrictsIDsRequest(districts.map(district => district.id), actionType, false)
        || await checkDataShema('Invalid format', districts, banDistrictSchema, {isPatch: actionType === 'patch'})
        || dataValidationReportFrom(true)
      break
    default:
      report = dataValidationReportFrom(false, 'Unknown action type', {actionType, districts})
  }

  return report
}

export const formatDistrict = district => {
  const {range_validity: rangeValidity, ...districtRest} = district
  const lastRecordDate = rangeValidity[0].value
  return {...districtRest, lastRecordDate}
}

export async function formatDataNova(postalFile) {
  /* eslint-disable camelcase */
  const headers = {
    '#Code_commune_INSEE': 'codeInsee',
    Nom_de_la_commune: 'nomCommune',
    Code_postal: 'codePostal',
    Libellé_d_acheminement: 'libelleAcheminement',
    'Libell�_d_acheminement': 'libelleAcheminement', // Postal file url returns wrong header charset code (UTF-8 instead of ISO-8859-1)
    Ligne_5: 'ligne5',
  }
  /* eslint-enable camelcase */

  const dataRaw = await Papa.parse(postalFile, {
    header: true,
    transformHeader: name => headers[name] || name,
    skipEmptyLines: true,
  })

  const districts = await getDistrictsFromCog(
    dataRaw.data.map(({codeInsee}) => codeInsee)
  )

  const districtsByInseeCode = districts.reduce(
    (acc, district) => ({
      ...acc,
      ...(district?.meta?.insee?.cog
        ? {[district.meta.insee.cog]: [...acc[district.meta.insee.cog], district.id]}
        : {}
      ),
    }), {})

  const banDistricts = Object.values(
    (dataRaw?.data || []).flatMap(({codeInsee, codePostal, libelleAcheminement}) => {
      const ids = districtsByInseeCode[codeInsee] || []
      return ids.map(id => ({id, codePostal: [codePostal], libelleAcheminement}))
    })
      .reduce(
        (acc, district) => {
          if (district.id) {
            if (acc[district.id]) {
              acc[district.id].codePostal = [...acc[district.id].codePostal, ...district.codePostal]
            } else {
              acc[district.id] = district
            }
          }

          return acc
        }, {}
      )
  )

  return banDistricts.map(({id, codePostal, libelleAcheminement}) => ({
    id,
    meta: {
      laPoste: {
        codePostal,
        libelleAcheminement,
        source: 'La Poste - dataNOVA',
      }
    }
  }))
}
