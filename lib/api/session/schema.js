import {object, string, number, date} from 'yup'

export const banSessionSchema = object({
  id: string().uuid().required(),
  sub: string().required().nonNullable(),
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
  createdAt: date().required(),
  updatedAt: date().required(),
}).noUnknown()
