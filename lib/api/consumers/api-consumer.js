import {setJobStatus} from '../job-status/models.js'
import {setAddresses, updateAddresses} from '../address/models.js'
import {checkAddresses} from '../address/utils.js'
import {setRoads, updateRoads} from '../road/models.js'
import {checkRoads} from '../road/utils.js'

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

const addressConsumer = async (jobType, addresses, statusID) => {
  const addressesCount = addresses.length
  const addressesValidation = await checkAddresses(addresses, jobType)
  if (addressesValidation.isValid) {
    switch (jobType) {
      case 'insert':
        await setAddresses(addresses)
        break
      case 'update':
        await updateAddresses(addresses)
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
      report: addressesValidation.report,
    })
  }
}

const roadConsumer = async (jobType, roads, statusID) => {
  const roadsCount = roads.length
  const roadValidation = await checkRoads(roads, jobType)
  if (roadValidation.isValid) {
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
      report: roadValidation.report,
    })
  }
}
