const {digestIDsFromBalUIDs} = require('./digest-ids-from-bal-uids.cjs')

const digestIDsFromBalAddress = (
  balAddress,
  version,
) => {
  switch (version) {
    case '1.4':
      return {
        addressID: balAddress?.idBanAdresse,
        mainTopoID: balAddress?.idBanToponyme,
        districtID: balAddress?.idBanCommune,
      }

    default: {
      const {uidAdresse: ids} = balAddress
      return digestIDsFromBalUIDs(ids)
    }
  }
}

module.exports = {digestIDsFromBalAddress}
