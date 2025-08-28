import {object, string, boolean, date, array, number} from 'yup'

// Schéma pour la table revision_status
export const revisionStatusSchema = object({
  revisionId: string().uuid().required(),
  codeCommune: string().trim().length(5).required(),
  communeName: string().trim().nullable(),
  submissionDate: date().required(),
  status: string().oneOf(['success', 'error', 'warning', 'info']).required(),
  isIntegratedInBan: boolean().required(),
  integrationDate: date().nullable(),
  errorType: string().trim().max(100).nullable(),
  message: string().nullable(),
  details: object().nullable(), // JSONB - peut contenir n'importe quoi
  notificationsSent: array().nullable(), // Array des notifications envoyées
  createdAt: date().required(),
  updatedAt: date().required(),
}).noUnknown()

// Schéma pour la table alert_subscribers
export const alertSubscriberSchema = object({
  id: string().uuid().required(),
  identifier: string().trim().max(100).required(),
  webhookUrl: string().url().max(500).required(),
  communesToFollow: array().of(string().length(5)).required(),
  statusesToFollow: array().of(string().oneOf(['success', 'error', 'warning', 'info'])).required()
    .test('valid-statuses', 'Tous les statuts doivent être valides', function(value) {
      if (!value) return true
      const validStatuses = ['success', 'error', 'warning', 'info']
      return value.every(status => validStatuses.includes(status))
    }),
  isActive: boolean().required(),
  lastNotificationAt: date().nullable(),
  failedAttemptsCount: number().integer().min(0).required(),
  config: object().nullable(), // JSONB pour config avancée
  createdAt: date().required(),
  updatedAt: date().required(),
}).noUnknown()