import {object, string, number, date} from 'yup'
import {banID} from '../schema.js'

export const banSessionSchema = object({
  id: banID.required(),
  sub: banID.required().nonNullable(),
  name: string().trim(),
  givenName: string().trim(),
  familyName: string().trim(),
  usualName: string().trim(),
  email: string().trim().nonNullable().required(),
  siret: number().integer().nonNullable().required(),
  aud: string().trim().nonNullable().required(),
  exp: number().integer().nonNullable().required(),
  iat: number().integer().nonNullable().required(),
  iss: string().trim().nonNullable().required(),
  createdAt: date().when('$isPatch', {
    is: true,
    otherwise: schema => schema.required(),
  }),
  updatedAt: date().when('$isPatch', {
    is: true,
    otherwise: schema => schema.required(),
  }),
}).noUnknown()
