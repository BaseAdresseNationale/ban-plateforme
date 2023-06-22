import {object, string, array} from 'yup'
import {banID, geometrySchema, labelSchema, cadastreSchema} from '../schema.js'

const typeValues = ['voie', 'lieu-dit', 'autre']

const typeSchema = object({
  label: string().trim(),
  value: string().trim().oneOf(typeValues).required(),
})

const metaSchema = object({
  cadastre: cadastreSchema
})

export const banCommonToponymSchema = object({
  id: banID.required(),
  districtID: banID.required(),
  label: array().of(labelSchema).required(),
  type: typeSchema.required(),
  geometry: geometrySchema.required(),
  updateDate: string().trim().required(),
  meta: metaSchema
})
