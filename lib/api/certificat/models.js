import {Certificate, sequelize} from '../../util/sequelize.js'

export const getCertificate = certificateID => Certificate.findByPk(certificateID, {raw: true})

export const getCertificates = certificateIDs => Certificate.findAll({
  where: {id: certificateIDs},
  raw: true
})

export const getCertificatesByAddress = address_id => Certificate.findAll({ // eslint-disable-line camelcase
  where: {address_id}, // eslint-disable-line camelcase
  aw: true
})

export const setCertificate = async certificates => {
  try {
    // Récupérer les détails de l'adresse pour chaque certificat
    const certificatesWithDetails = await Promise.all(certificates.map(async certificate => {
      const addressDetails = await getAddressDetailsById(certificate.address_id)
      if (addressDetails.length === 0) {
        // Lever une erreur si les détails de l'adresse ne sont pas trouvés
        throw new Error(`Address details not found for address_id ${certificate.address_id}`)
      }

      return {
        ...certificate,
        number: addressDetails[0].number,
        suffix: addressDetails[0].suffix,
        rue: addressDetails[0].rue,
        nom_commune: addressDetails[0].nom_commune, // eslint-disable-line camelcase
        cog: addressDetails[0].cog,
        parcelles: addressDetails[0].parcelles,
      }
    }))

    // Créer les certificats avec tous les détails remplis
    return await Certificate.bulkCreate(certificatesWithDetails)
  } catch (error) {
    console.error(`Error creating certificates: ${error.message}`)
    throw error
  }
}

export const getAddressDetailsById = async addressId => {
  try {
    const results = await sequelize.query(`
          SELECT 
          a.id as address_id,
          a.number,
          a.suffix,
          ct.labels[1]->>'value' as rue,
          d.labels[1]->>'value' as nom_commune,
          d.meta->'insee'->>'cog' as cog,
          a.meta->'cadastre'->'ids' as parcelles   
      FROM 
          "ban"."address" AS a
      JOIN 
          "ban"."district" AS d ON a."districtID" = d.id
      LEFT JOIN 
          "ban"."common_toponym" AS ct ON ct.id = a."mainCommonToponymID"
            WHERE
                a.id = :addressId
        `, {
      replacements: {addressId},
      type: sequelize.QueryTypes.SELECT
    })
    if (results.length > 0) {
      return results
    }

    return []
  } catch (error) {
    console.error(`Error executing query: ${error.message}`)
    throw error
  }
}

export const checkCertifiedActiveAndHasParcellesById = async addressId => {
  try {
    const results = await sequelize.query(`
            SELECT 
            *
            FROM 
                "ban"."address" AS a
            WHERE
                a.id = :addressId
                and certified=true 
                and "isActive"=true 
                and jsonb_array_length(a.meta->'cadastre'->'ids') > 0
        `, {
      replacements: {addressId},
      type: sequelize.QueryTypes.SELECT
    })
    if (results.length > 0) {
      return true
    }

    return false
  } catch (error) {
    console.error(`Error executing query: ${error.message}`)
    throw error
  }
}
