import {setAddresses, updateAddresses, deleteAddresses, setAddressJobStatus} from './models.js'
import {checkAddressesRequest} from './utils.js'

export default async function addressConsumer({data: {type, addresses, statusID}}, done) {
  const addressesCount = addresses.length
  try {
    const addressesValidation = await checkAddressesRequest(addresses, type)

    if (addressesValidation.isValid) {
      switch (type) {
        case 'insert':
          await setAddresses(addresses)
          break
        case 'update':
          await updateAddresses(addresses)
          break
        case 'delete':
          await deleteAddresses(addresses.map(({id}) => id))
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
