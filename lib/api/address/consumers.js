import {setAddresses, updateAddresses, setAddressJobStatus} from './models.js'
import {checkAddresses} from './utils.js'

export default async function addressConsumer({data: {type, addresses, statusID}}, done) {
  const addressesCount = addresses.length
  try {
    const addressesValidation = await checkAddresses(addresses, type)
    if (addressesValidation.isValid) {
      switch (type) {
        case 'insert':
          await setAddresses(addresses)
          break
        case 'update':
          await updateAddresses(addresses)
          break
        default:
          console.warn(`Address Consumer Warn: Unknown job type : '${type}'`)
      }

      await setAddressJobStatus(statusID, {
        status: 'success',
        type,
        count: addressesCount,
      })
    } else {
      await setAddressJobStatus(statusID, {
        status: 'error',
        type,
        count: addressesCount,
        message: 'addresses are not valid',
        report: addressesValidation.report,
      })
    }
  } catch (error) {
    console.error(error)
    await setAddressJobStatus(statusID, {
      status: 'error',
      type,
      count: addressesCount,
      message: 'Internal Server Error',
    })
  }

  done()
}
