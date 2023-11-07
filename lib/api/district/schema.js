import {object, array, date, bool} from 'yup'
import {banID, labelSchema, inseeSchema, balSchema} from '../schema.js'

const configSchema = object({
  useBanId: bool()
}).noUnknown()

const metaSchema = object({
  insee: inseeSchema,
  bal: balSchema,
}).noUnknown()

export const banDistrictSchema = object({
  id: banID.required(),
  labels: array().of(labelSchema).required(),
  updateDate: date().required(),
  config: configSchema,
  meta: metaSchema
}).noUnknown()

export const banDistrictSchemaForPatch = object({
  id: banID.required(),
  labels: array().of(labelSchema).default(null).nullable(),
  updateDate: date(),
  config: configSchema,
  meta: metaSchema.default(null).nullable(),
}).noUnknown()

export const districtDefaultOptionalValues = {
  config: undefined,
}
