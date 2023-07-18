import {object, array, string} from 'yup'
import {banID, labelSchema, inseeSchema} from '../schema.js'

const metaSchema = object({
  insee: inseeSchema
})

export const banDistrictSchema = object({
  id: banID.required(),
  labels: array().of(labelSchema).required(),
  updateDate: string().trim().required(),
  meta: metaSchema
})
