import {object, string, number, boolean, date} from 'yup'
import {banID} from '../schema.js'

export const banActionSchema = object({
  id: banID.required(),
  districtID: banID.when('$isPatch', {
    is: true,
    otherwise: schema => schema.required(),
  }),
  status: boolean().required(),
  label: string().trim().required(),
  siren: number().integer().nonNullable(),
  sessionID: banID.when('$isPatch', {
    is: true,
    otherwise: schema => schema.required(),
  }),
  createdAt: date().when('$isPatch', {
    is: true,
    otherwise: schema => schema.required(),
  }),
  updatedAt: date().when('$isPatch', {
    is: true,
    otherwise: schema => schema.required(),
  }),
}).noUnknown()

export const addressDefaultOptionalValues = {
  secondaryCommonToponymIDs: [],
  suffix: null,
  labels: [],
  certified: false,
  meta: null,
}

