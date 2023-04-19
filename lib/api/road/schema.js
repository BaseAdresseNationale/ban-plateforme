import {object, string} from 'yup'

export const banRoadSchema = object({
  id: string().trim().uuid().required(),
  codeCommune: string().trim().required(),
  voieLabel: string().trim().required(),
  type: string().trim().required(),
})
