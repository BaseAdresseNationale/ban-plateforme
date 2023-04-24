import {setJobStatus} from '../job-status/models.js'
import {setAddresses, updateAddresses, deleteAddresses} from '../address/models.js'
import {checkAddressesRequest, checkAddressesIDsRequest, dataValidationReportFrom} from '../address/utils.js'
import {setRoads, updateRoads} from '../road/models.js'
import {checkRoadsRequest} from '../road/utils.js'

export default async function apiConsumers({data: {dataType, jobType, data, statusID}}, done) {
  try {
    switch (dataType) {
      case 'address':
        await addressConsumer(jobType, data, statusID)
        break
      case 'road':
        await roadConsumer(jobType, data, statusID)
        break
      default:
        console.warn(`Consumer Warn: Unknown data type : '${dataType}'`)
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
      case 'insert':
        await setAddresses(payload)
        break
      case 'update':
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

const roadConsumer = async (jobType, roads, statusID) => {
  const roadsCount = roads.length
  const dataRoadValidationReport = await checkRoadsRequest(roads, jobType)
  if (dataRoadValidationReport.isValid) {
    switch (jobType) {
      case 'insert':
        await setRoads(roads)
        break
      case 'update':
        await updateRoads(roads)
        break
      default:
        console.warn(`Address Consumer Warn: Unknown job type : '${jobType}'`)
    }

    await setJobStatus(statusID, {
      status: 'success',
      dataType: 'road',
      jobType,
      count: roadsCount,
    })
  } else {
    await setJobStatus(statusID, {
      status: 'error',
      dataType: 'road',
      jobType,
      count: roadsCount,
      message: 'roads are not valid',
      report: dataRoadValidationReport.report,
    })
  }
}
