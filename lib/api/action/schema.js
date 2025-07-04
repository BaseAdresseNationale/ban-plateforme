import {object, string, boolean, date} from 'yup'
import {banID} from '../schema.js'

export const banActionSchema = object({
  id: string().uuid().required(),
  districtID: banID.required(),
  status: boolean().required(),
  label: string().trim().required(),
  siren: string().number().integer().nonNullable().required(),
  sessionID: string.uuid().required(),
  createdAt: date().required(),
  updatedAt: date().required(),
}).noUnknown()
