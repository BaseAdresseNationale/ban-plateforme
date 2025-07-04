import {object, string, date} from 'yup'

export const banSessionSchema = object({
  id: string().uuid(),
  sub: string().nonNullable().required(),
  name: string().trim(),
  givenName: string().trim(),
  familyName: string().trim(),
  usualName: string().trim(),
  email: string().trim().nonNullable().required(),
  siret: string().nonNullable().required(),
  aud: string().trim().nonNullable().required(),
  exp: string().nonNullable().required(),
  iat: string().nonNullable().required(),
  iss: string().trim().nonNullable().required(),
  createdAt: date(),
  updatedAt: date(),
}).noUnknown()
