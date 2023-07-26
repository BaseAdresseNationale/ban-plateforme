import {object, array, string, bool} from 'yup'
import {banID, labelSchema, inseeSchema} from '../schema.js'

const configSchema = object({
  useBanId: bool()
})

const metaSchema = object({
  insee: inseeSchema
})

export const banDistrictSchema = object({
  id: banID.required(),
  labels: array().of(labelSchema).required(),
  updateDate: string().trim().required(),
  config: configSchema,
  meta: metaSchema
})
