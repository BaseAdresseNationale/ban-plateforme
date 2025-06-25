import {object, string, number, date} from 'yup'
import {banID} from '../schema.js'

export const banSessionSchema = object({
  id: banID.required(),
  sub: banID.required().nonNullable(),
  name: string().trim(),
  givenName: string().trim(),
  familyName: string().trim(),
  usualName: string().trim(),
  email: string().trim().nonNullable(),
  siret: number().integer().nonNullable(),
  aud: string().trim().nonNullable(),
  exp: number().integer().nonNullable(),
  iat: number().integer().nonNullable(),
  iss: string().trim().nonNullable(),
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

