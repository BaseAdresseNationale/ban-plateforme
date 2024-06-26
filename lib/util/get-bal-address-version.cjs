const getBalAddressVersion = (balAddress = {}) => {
  const {idBanCommune: districtID, uidAdresse: ids} = balAddress

  if (districtID) {
    return '1.4'
  }

  if (ids) {
    return '1.3'
  }

  return '1.x'
}

module.exports = {getBalAddressVersion}
