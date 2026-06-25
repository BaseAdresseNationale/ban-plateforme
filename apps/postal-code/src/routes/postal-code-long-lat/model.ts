import { Attributes, col, fn, where, Model, Op } from "sequelize"
import {getMultidistributed} from "../../routes/postal-datanova/model.js"
import { PostalArea } from "../../util/sequelize.js"
import { logger } from "@ban/tools"


const getPostalCode = async (long: string | undefined, lat: string | undefined, inseeCom: string | undefined): Promise<{code_postal: string | null}> => {
    try {
        if (inseeCom && long && lat) {
            const xCoord = Number(long)
            const yCoord = Number(lat)
            const cpFromLatLong = await PostalArea.findOne({
                attributes: ['postalCode'],
                where: {
                  inseeCom: inseeCom,
                  [Op.and]: where(
                    fn(
                      'ST_Contains',
                      col('geometry'),
                      fn(
                        'ST_SetSRID',
                        fn('ST_MakePoint', xCoord, yCoord),
                        2154
                      )
                    ),
                    true
                  )
                }
              });
            return {
                code_postal: cpFromLatLong?.dataValues.postalCode
            }
        } else if (inseeCom && !long && !lat) {
            const cpFromInseeCom : Attributes<Model> = await getMultidistributed(inseeCom)
            if (cpFromInseeCom?.postalCodes?.length <= 1){
                return {
                    code_postal: cpFromInseeCom.postalCodes[0]
                }
            }
            else {
                return {
                    code_postal: cpFromInseeCom?.postalCodes
                }
            }
        } if (long && lat && !inseeCom) {
            const xCoord = Number(long)
            const yCoord = Number(lat)
            const cpFromLatLong = await PostalArea.findAll({
                attributes: ['postalCode'],
                where: 
                     where(
                        fn(
                            'ST_Contains',
                            col('geometry'),
                            fn(
                               'ST_SetSRID',
                                fn('ST_MakePoint', xCoord, yCoord),
                                2154
                              )
                        ),
                        true
                    )
                
            })
            return {
                code_postal: cpFromLatLong[0]?.dataValues.postalCode
            }
        }
        else {
            // logger.debug('[postal-code-service] inseeCom or long/lat are required', {inseeCom, long, lat})
            throw new Error('InseeCom or long/lat are required')
        }

    } catch (error) {
        throw new Error(error as string)
    }
}

export default { getPostalCode }