import {Certificate, sequelize} from '../../util/sequelize.js'

const getDataForCertificateQuery = `
      SELECT
          a.id as "addressID",
          a.number as "addressNumber",
          a.suffix as "addressSuffix",
          ct.labels[1]->>'value' as "commonToponymDefaultLabel",
          d.labels[1]->>'value' as "districtDefaultLabel",
          a.labels[1]->>'value' as "lieuDitComplementNomDefaultLabel",
          d.meta->'insee'->>'cog' as "districtCog",
          d.config as "districtConfig",
          a.meta->'cadastre'->'ids' as "cadastreIDs",
          a.certified,
          a."isActive"
      FROM 
          "ban"."address" AS a
      JOIN 
          "ban"."district" AS d ON a."districtID" = d.id
      LEFT JOIN 
          "ban"."common_toponym" AS ct ON ct.id = a."mainCommonToponymID"
      WHERE
          a.id = :addressId
          and a.certified=true 
          and a."isActive"=true 
          and jsonb_array_length(a.meta->'cadastre'->'ids') > 0
      
`

export const getCertificate = certificateID => Certificate.findByPk(certificateID, {raw: true})

export const getCertificates = certificateIDs => Certificate.findAll({
  where: {id: certificateIDs},
  raw: true
})

export const getCertificatesByAddress = addressID => Certificate.findAll({
  where: {address_id: addressID}, // eslint-disable-line camelcase
  raw: true
})

export const setCertificate = async certificate => Certificate.create(certificate)

export const getDataForCertificate = async addressId => {
  try {
    const [data] = await sequelize.query(getDataForCertificateQuery, {
      replacements: {addressId},
      raw: true,
    })

    console.log(`Data for certificate: ${JSON.stringify(data)}`)
    return data[0]
  } catch (error) {
    console.error(`Error executing query: ${error.message}`)
    throw error
  }
}
