export const formatDataForCertificate = data => {
  const fullAddress = {
    number: data.addressNumber,
    commonToponymDefaultLabel: data.commonToponymDefaultLabel,
    suffix: data.addressSuffix,
    districtDefaultLabel: data.districtDefaultLabel,
    cog: data.districtCog,
    lieuDitComplementNomDefaultLabel: data.lieuDitComplementNomDefaultLabel
  }

  return {
    address_id: data.addressID, // eslint-disable-line camelcase
    full_address: fullAddress, // eslint-disable-line camelcase
    cadastre_ids: data.cadastreIDs, // eslint-disable-line camelcase
  }
}
