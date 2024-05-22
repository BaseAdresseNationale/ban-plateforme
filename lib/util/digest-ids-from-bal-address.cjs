const {digestIDsFromBalUIDs} = require('./digest-ids-from-bal-uids.cjs')

const digestIDsFromBalAddress = (
  balAddress,
  version,
) => {
  const defaultIDs = {
    addressID: undefined,
    mainTopoID: undefined,
    secondaryTopoIDs: undefined,
    districtID: undefined,
  }

  switch (version) {
    case '1.4':
      return {
        ...defaultIDs,
        addressID: balAddress?.idBanAdresse,
        mainTopoID: balAddress?.idBanToponyme,
        secondaryTopoIDs: undefined,
        districtID: balAddress?.idBanCommune,
      }

    case '1.3': {
      const {uidAdresse: ids} = balAddress
      return {
        ...defaultIDs,
        ...digestIDsFromBalUIDs(ids)
      }
    }

    default:
      return defaultIDs
  }
}

module.exports = {digestIDsFromBalAddress}
