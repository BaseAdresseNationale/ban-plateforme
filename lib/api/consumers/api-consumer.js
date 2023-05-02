import {setJobStatus} from '../job-status/models.js'
import {setAddresses, updateAddresses, deleteAddresses} from '../address/models.js'
import {checkAddressesRequest, checkAddressesIDsRequest, dataValidationReportFrom} from '../address/utils.js'
import {setCommonToponyms, updateCommonToponyms} from '../common-toponym/models.js'
import {checkCommonToponymsRequest} from '../common-toponym/utils.js'

export default async function apiConsumers({data: {dataType, jobType, data, statusID}}, done) {
  try {
    switch (dataType) {
      case 'address':
        await addressConsumer(jobType, data, statusID)
        break
      case 'commonToponym':
        await commonToponymConsumer(jobType, data, statusID)
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

const commonToponymConsumer = async (jobType, commonToponyms, statusID) => {
  const commonToponymsCount = commonToponyms.length
  const dataCommonToponymValidationReport = await checkCommonToponymsRequest(commonToponyms, jobType)
  if (dataCommonToponymValidationReport.isValid) {
    switch (jobType) {
      case 'insert':
        await setCommonToponyms(commonToponyms)
        break
      case 'update':
        await updateCommonToponyms(commonToponyms)
        break
      default:
        console.warn(`Address Consumer Warn: Unknown job type : '${jobType}'`)
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
      report: dataCommonToponymValidationReport.report,
    })
  }
}
