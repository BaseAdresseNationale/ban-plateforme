import {Certificate, Datanova, sequelize} from '../../util/sequelize.js'
import {getPostalCode} from '../../models/commune.cjs'

const getDataForCertificateQuery = `
      SELECT
          a.id as "addressID",
          a.number as "addressNumber",
          a.suffix as "addressSuffix",
          ct.labels[1]->>'value' as "commonToponymDefaultLabel",
          d.labels[1]->>'value' as "districtDefaultLabel",
          a.labels[1]->>'value' as "lieuDitComplementNomDefaultLabel",
          d.meta->'insee'->>'cog' as "districtCog",
          COALESCE(dc.config, '{}'::jsonb) as "districtConfig",
          a.meta->'cadastre'->'ids' as "cadastreIDs",
          a.certified,
          a."isActive"
      FROM 
          "ban"."address" AS a
      JOIN 
          "ban"."district" AS d ON a."districtID" = d.id
      LEFT JOIN
          "ban"."district_config" AS dc ON dc.district_id = d.id
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

export const getMultidistributed = async districtCog => Datanova.findOne({
  where: {inseeCom: districtCog},
  raw: true
})

export const getDataForCertificate = async addressId => {
  try {
    const [data] = await sequelize.query(getDataForCertificateQuery, {
      replacements: {addressId},
      raw: true,
    })

    const multidistributed = await getMultidistributed(data[0].districtCog)
    data[0].multidistributed = multidistributed.postalCodes.length > 1
    data[0].postalCode = await getPostalCode(addressId)

    return data[0]
  } catch (error) {
    console.error(`Error executing query: ${error.message}`)
    throw error
  }
}

export const countCertificatesByDistrict = async districtCog => {
  const [result] = await sequelize.query(
    `SELECT COUNT(*) AS count
     FROM "ban"."certificate"
     WHERE full_address ->> 'cog' = :districtCog`,
    {
      replacements: {districtCog},
      type: sequelize.QueryTypes.SELECT
    }
  )
  return Number(result.count)
}

export const countCertificatesByDistrictPerMonth = async (districtCog, year) => {
  const startOfYear = new Date(Date.UTC(year, 0, 1))
  const startOfNextYear = new Date(Date.UTC(year + 1, 0, 1))

  const results = await sequelize.query(
    `SELECT
        EXTRACT(MONTH FROM "createdAt")::int AS month,
        COUNT(*)::int AS count
     FROM "ban"."certificate"
     WHERE full_address ->> 'cog' = :districtCog
       AND "createdAt" >= :startOfYear
       AND "createdAt" < :startOfNextYear
     GROUP BY EXTRACT(MONTH FROM "createdAt")
     ORDER BY month`,
    {
      replacements: {districtCog, startOfYear, startOfNextYear},
      type: sequelize.QueryTypes.SELECT
    }
  )

  const counts = Array.from({length: 12}, (_, i) => ({month: i + 1, count: 0}))
  for (const row of results) {
    counts[row.month - 1].count = row.count
  }

  const total = counts.reduce((sum, {count}) => sum + count, 0)

  return [{month: 'all', count: total}, ...counts]
}
