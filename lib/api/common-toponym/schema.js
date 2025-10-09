import {object, array, date} from 'yup'
import {banID, geometrySchema, labelSchema, cadastreSchema, balSchema, idfixSchema} from '../schema.js'

const metaSchema = object({
  cadastre: cadastreSchema,
  bal: balSchema,
  idfix: idfixSchema,
}).noUnknown()

export const banCommonToponymSchema = object({
  id: banID.required(),
  districtID: banID.when('$isPatch', {
    is: true,
    otherwise: schema => schema.required(),
  }),
  labels: array().of(labelSchema).when('$isPatch', {
    is: true,
    // eslint-disable-next-line unicorn/no-thenable
    then: schema => schema.default(null).nullable(),
    otherwise: schema => schema.required(),
  }),
  geometry: geometrySchema.default(null).nullable(),
  updateDate: date().optional().nullable(),
  meta: metaSchema
}).noUnknown()

export const commonToponymDefaultOptionalValues = {
  geometry: null,
  meta: null,
}
