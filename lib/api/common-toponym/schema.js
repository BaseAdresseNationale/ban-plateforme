import {object, array, date} from 'yup'
import {banID, geometrySchema, labelSchema, cadastreSchema, balSchema} from '../schema.js'

const metaSchema = object({
  cadastre: cadastreSchema,
  bal: balSchema,
})

export const banCommonToponymSchema = object({
  id: banID.required(),
  districtID: banID.required(),
  labels: array().of(labelSchema).required(),
  geometry: geometrySchema.default(null).nullable(),
  updateDate: date().required(),
  meta: metaSchema
})
