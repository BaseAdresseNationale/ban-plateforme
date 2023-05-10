import {object, string, array} from 'yup'

export const banDistrictID = string().trim().uuid()

const labelSchema = object({
  isoCode: string().trim().required(),
  value: string().trim().required(),
})

export const banDistrictSchema = object({
  id: banDistrictID.required(),
  label: array().of(labelSchema).required(),
})
