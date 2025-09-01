import {object, string, boolean, date, array} from 'yup'

// Schéma pour la table revisions
export const revisionSchema = object({
  id: string().uuid().required(),
  revisionId: string().required(),
  cog: string().trim().length(5).required(),
  districtName: string().trim().nullable(),
  districtId: string().uuid().nullable(),
  status: string().oneOf(['success', 'error', 'warning', 'info']).required(),
  message: string().nullable(),
  createdAt: date().required(),
}).noUnknown()

// Schéma pour la table subscribers
export const subscriberSchema = object({
  id: string().uuid().required(),
  webhookUrl: string().url().max(500).required(),
  districtsToFollow: array().of(string().length(5)).required(),
  statusesToFollow: array().of(string().oneOf(['success', 'error', 'warning', 'info'])).required(),
  isActive: boolean().required(),
  createdAt: date().required(),
}).noUnknown()