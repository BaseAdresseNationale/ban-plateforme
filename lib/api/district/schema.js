import {object, array, date, bool} from 'yup'
import {banID, labelSchema, inseeSchema, balSchema} from '../schema.js'

const configSchema = object({
  useBanId: bool()
})

const metaSchema = object({
  insee: inseeSchema,
  bal: balSchema,
})

export const banDistrictSchema = object({
  id: banID.required(),
  labels: array().of(labelSchema).required(),
  updateDate: date().required(),
  config: configSchema,
  meta: metaSchema
})

export const banDistrictSchemaForPatch = object({
  id: banID.required(),
  labels: array().of(labelSchema).default(null).nullable(),
  updateDate: date(),
  config: configSchema,
  meta: metaSchema.default(null).nullable(),
})

export const districtDefaultOptionalValues = {
  config: undefined,
}
