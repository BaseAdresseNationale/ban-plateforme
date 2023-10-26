import queue from '../../util/queue.cjs'
import {getJobStatus, setJobStatus} from '../job-status/models.js'
import {setAddresses, updateAddresses, deleteAddresses, getAllDistrictIDsFromAddresses} from '../address/models.js'
import {checkAddressesRequest, checkAddressesIDsRequest} from '../address/utils.js'
import {setCommonToponyms, updateCommonToponyms, deleteCommonToponyms, getAllDistrictIDsFromCommonToponyms} from '../common-toponym/models.js'
import {checkCommonToponymsRequest, checkCommonToponymsIDsRequest} from '../common-toponym/utils.js'
import {setDistricts, updateDistricts, deleteDistricts} from '../district/models.js'
import {checkDistrictsRequest, checkDistrictsIDsRequest} from '../district/utils.js'
import {dataValidationReportFrom, formatObjectWithDefaults, addOrUpdateJob} from '../helper.js'
import {addressDefaultOptionalValues} from '../address/schema.js'
import {commonToponymDefaultOptionalValues} from '../common-toponym/schema.js'
import {districtDefaultOptionalValues} from '../district/schema.js'

const exportToExploitationDBQueue = queue('export-to-exploitation-db')
const exportToExploitationDBJobDelay = process.env.EXPORT_TO_EXPLOITATION_DB_JOB_DELAY || 10_000

export default async function apiConsumers({data: {dataType, jobType, data, statusID}}, done) {
  try {
    switch (dataType) {
      case 'address':
        await addressConsumer(jobType, data, statusID)
        break
      case 'commonToponym':
        await commonToponymConsumer(jobType, data, statusID)
        break
      case 'district':
        await districtConsumer(jobType, data, statusID)
        break
      default:
        console.warn(`Consumer Warn: Unknown data type : '${dataType}'`)
    }

    const jobStatus = await getJobStatus(statusID)
    if (jobStatus.status === 'success') {
      // Export data from the postgresql database to the exploitation database
      const relatedDistrictIDs = await extractRelatedDistrictIDs(dataType, jobType, data)
      const uniqueRelatedDistrictIDs = [...new Set(relatedDistrictIDs)]
      const addOrUpdateJobPromises = uniqueRelatedDistrictIDs.map(async districtID => {
        await addOrUpdateJob(
          exportToExploitationDBQueue,
          districtID,
          {districtID},
          exportToExploitationDBJobDelay
        )
      })
      await Promise.all(addOrUpdateJobPromises)
    }
  } catch (error) {
    console.error(error)
    await setJobStatus(statusID, {
      status: 'error',
      dataType,
      jobType,
      message: 'Internal Server Error',
    })
  }

  done()
}

const addressConsumer = async (jobType, payload, statusID) => {
  const checkRequestData = async (payload, jobType) => {
    switch (jobType) {
      case 'insert':
      case 'update':
      case 'patch':
        return checkAddressesRequest(payload, jobType)
      case 'delete':
        return checkAddressesIDsRequest(payload, jobType)
      default:
        return dataValidationReportFrom(false, 'Unknown action type', {actionType: jobType, payload})
    }
  }

  const requestDataValidationReport = await checkRequestData(payload, jobType)
  const addressesCount = payload.length
  if (requestDataValidationReport.isValid) {
    switch (jobType) {
      case 'insert': {
        const formattedAddresses = payload.map(address => (
          formatObjectWithDefaults(address, addressDefaultOptionalValues)
        ))
        await setAddresses(formattedAddresses)
        break
      }

      case 'update': {
        const formattedAddresses = payload.map(address => (
          formatObjectWithDefaults(address, addressDefaultOptionalValues)
        ))
        await updateAddresses(formattedAddresses)
        break
      }

      case 'patch':
        await updateAddresses(payload)
        break
      case 'delete':
        await deleteAddresses(payload)
        break
      default:
        console.warn(`Address Consumer Warn: Unknown job type : '${jobType}'`)
    }

    await setJobStatus(statusID, {
      status: 'success',
      dataType: 'address',
      jobType,
      count: addressesCount,
    })
  } else {
    await setJobStatus(statusID, {
      status: 'error',
      dataType: 'address',
      jobType,
      count: addressesCount,
      message: 'addresses are not valid',
      report: requestDataValidationReport.report,
    })
  }
}

const commonToponymConsumer = async (jobType, payload, statusID) => {
  const checkRequestData = async (payload, jobType) => {
    switch (jobType) {
      case 'insert':
      case 'update':
      case 'patch':
        return checkCommonToponymsRequest(payload, jobType)
      case 'delete':
        return checkCommonToponymsIDsRequest(payload, jobType)
      default:
        return dataValidationReportFrom(false, 'Unknown action type', {actionType: jobType, payload})
    }
  }

  const requestDataValidationReport = await checkRequestData(payload, jobType)
  const commonToponymsCount = payload.length
  if (requestDataValidationReport.isValid) {
    switch (jobType) {
      case 'insert': {
        const formattedCommonToponyms = payload.map(commonToponym => (
          formatObjectWithDefaults(commonToponym, commonToponymDefaultOptionalValues)
        ))
        await setCommonToponyms(formattedCommonToponyms)
        break
      }

      case 'update': {
        const formattedCommonToponyms = payload.map(commonToponym => (
          formatObjectWithDefaults(commonToponym, commonToponymDefaultOptionalValues)
        ))
        await updateCommonToponyms(formattedCommonToponyms)
        break
      }

      case 'patch':
        await updateCommonToponyms(payload)
        break
      case 'delete':
        await deleteCommonToponyms(payload)
        break
      default:
        console.warn(`Common Toponym Consumer Warn: Unknown job type : '${jobType}'`)
    }

    await setJobStatus(statusID, {
      status: 'success',
      dataType: 'commonToponym',
      jobType,
      count: commonToponymsCount,
    })
  } else {
    await setJobStatus(statusID, {
      status: 'error',
      dataType: 'commonToponym',
      jobType,
      count: commonToponymsCount,
      message: 'common toponyms are not valid',
      report: requestDataValidationReport.report,
    })
  }
}

const districtConsumer = async (jobType, payload, statusID) => {
  const checkRequestData = async (payload, jobType) => {
    switch (jobType) {
      case 'insert':
      case 'update':
      case 'patch':
        return checkDistrictsRequest(payload, jobType)
      case 'delete':
        return checkDistrictsIDsRequest(payload, jobType)
      default:
        return dataValidationReportFrom(false, 'Unknown action type', {actionType: jobType, payload})
    }
  }

  const requestDataValidationReport = await checkRequestData(payload, jobType)
  const districtsCount = payload.length
  if (requestDataValidationReport.isValid) {
    switch (jobType) {
      case 'insert': {
        const formattedDistricts = payload.map(district => (
          formatObjectWithDefaults(district, districtDefaultOptionalValues)
        ))
        await setDistricts(formattedDistricts)
        break
      }

      case 'update': {
        const formattedDistricts = payload.map(district => (
          formatObjectWithDefaults(district, districtDefaultOptionalValues)
        ))
        await updateDistricts(formattedDistricts)
        break
      }

      case 'patch':
        await updateDistricts(payload)
        break
      case 'delete':
        await deleteDistricts(payload)
        break
      default:
        console.warn(`District Consumer Warn: Unknown job type : '${jobType}'`)
    }

    await setJobStatus(statusID, {
      status: 'success',
      dataType: 'district',
      jobType,
      count: districtsCount,
    })
  } else {
    await setJobStatus(statusID, {
      status: 'error',
      dataType: 'district',
      jobType,
      count: districtsCount,
      message: 'districts are not valid',
      report: requestDataValidationReport.report,
    })
  }
}

export const extractRelatedDistrictIDs = async (dataType, jobType, payload) => {
  switch (dataType) {
    case 'address':
      switch (jobType) {
        case 'insert':
        case 'update':
        case 'patch':
          return getAllDistrictIDsFromAddresses(payload.map(({id}) => id))
        case 'delete':
          return getAllDistrictIDsFromAddresses(payload)
        default:
          console.warn(`Unknown job type : '${jobType}'`)
      }

      break
    case 'commonToponym':
      switch (jobType) {
        case 'insert':
        case 'update':
        case 'patch':
          return getAllDistrictIDsFromCommonToponyms(payload.map(({id}) => id))
        case 'delete':
          return getAllDistrictIDsFromCommonToponyms(payload)
        default:
          console.warn(`Unknown job type : '${jobType}'`)
      }

      break
    case 'district':
      switch (jobType) {
        case 'insert':
        case 'update':
        case 'patch':
          return payload.map(({id}) => id)
        case 'delete':
          return payload
        default:
          console.warn(`Unknown job type : '${jobType}'`)
      }

      break
    default:
      console.warn(`Unknown data type : '${dataType}'`)
  }
}
