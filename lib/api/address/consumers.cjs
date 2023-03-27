const {setAddresses, setAddressJobStatus} = require('./models.cjs')
const {checkAddresses} = require('./utils.cjs')

async function addressConsumer({data: {type, addresses, statusID}}, done) {
  const addressesCount = addresses.length
  try {
    const addressesValidation = await checkAddresses(type, addresses)
    if (addressesValidation.isValid) {
      await setAddresses(addresses)
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

module.exports = addressConsumer
