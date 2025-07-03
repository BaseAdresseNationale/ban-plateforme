import {object, string, number, boolean, date} from 'yup'
import {banID} from '../schema.js'

export const banActionSchema = object({
  id: string.uuid().required(),
  districtID: banID.required(),
  status: boolean().required(),
  label: string().trim().required(),
  siren: number().integer().nonNullable().required(),
  sessionID: string.uuid().required(),
  createdAt: date().when('$isPatch', {
    is: true,
    otherwise: schema => schema.required(),
  }),
  updatedAt: date().when('$isPatch', {
    is: true,
    otherwise: schema => schema.required(),
  }),
}).noUnknown()
