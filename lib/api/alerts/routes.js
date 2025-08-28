import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'
import analyticsMiddleware from '../../middleware/analytics.js'
import auth from '../../middleware/auth.js'

import {handleAPIResponse} from '../helper.js'
import {getCommuneStatus, createSubscriber, sendWebhookNotifications} from './utils.js'
import {object, string, boolean, date, array} from 'yup'
import {RevisionStatus, AlertSubscriber} from './models.js'

const app = new express.Router()
app.use(express.json())

/**
 * @swagger
 * /api/alerts/communes/{codeCommune}/status:
 *   get:
 *     summary: Obtenir le statut d'une commune
 *     description: Récupère le statut détaillé des révisions BAL d'une commune (dernière intégrée, dernières soumissions, erreurs)
 *     tags:
 *       - 🚨 Alertes & Notifications
 *     parameters:
 *       - in: path
 *         name: codeCommune
 *         required: true
 *         schema:
 *           type: string
 *           example: "33032"
 *           pattern: '^[0-9]{5}$'
 *         description: Code commune sur 5 chiffres
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *           default: 10
 *           minimum: 1
 *           maximum: 100
 *         description: Nombre de révisions récentes à retourner
 *     responses:
 *       200:
 *         description: Statut de la commune récupéré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                   format: date-time
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Statut commune récupéré avec succès
 *                 response:
 *                   type: object
 *                   properties:
 *                     commune:
 *                       type: object
 *                       properties:
 *                         code:
 *                           type: string
 *                           example: "33032"
 *                         nom:
 *                           type: string
 *                           example: "Bassens"
 *                     derniere_integration:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         revisionId:
 *                           type: string
 *                           format: uuid
 *                         date:
 *                           type: string
 *                           format: date-time
 *                         status:
 *                           type: string
 *                           enum: [success, error, warning, info]
 *                     revisions_recentes:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/RevisionStatus'
 *       404:
 *         description: Commune non trouvée
 *       400:
 *         description: Code commune invalide
 */
app.get('/communes/:codeCommune/status', analyticsMiddleware, async (req, res) => {
  try {
    const {codeCommune} = req.params
    const limit = Number(req.query.limit) || 10

    // Validation du code commune (5 chiffres)
    if (!/^[0-9]{5}$/.test(codeCommune)) {
      handleAPIResponse(res, 400, 'Code commune invalide (5 chiffres requis)', {})
      return
    }

    if (limit > 100) {
      handleAPIResponse(res, 400, 'Limite maximum : 100 révisions', {})
      return
    }

    const communeStatus = await getCommuneStatus(codeCommune, limit)
    
    if (!communeStatus) {
      handleAPIResponse(res, 404, 'Commune non trouvée', {})
      return
    }

    handleAPIResponse(res, 200, 'Statut commune récupéré avec succès', communeStatus)
  } catch (error) {
    console.error('Erreur récupération statut commune:', error)
    handleAPIResponse(res, 500, 'Erreur interne du serveur', {})
  }
})

/**
 * @swagger
 * /api/alerts/subscribers:
 *   post:
 *     summary: Créer un abonnement aux alertes
 *     description: Permet de s'inscrire aux notifications webhook pour suivre les statuts des révisions BAL
 *     tags:
 *       - 🚨 Alertes & Notifications
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - webhookUrl
 *             properties:
 *               identifier:
 *                 type: string
 *                 example: "mon-service-ban"
 *                 maxLength: 100
 *                 description: Identifiant unique pour cet abonnement
 *               webhookUrl:
 *                 type: string
 *                 format: uri
 *                 example: "https://mon-service.fr/webhooks/ban-alerts"
 *                 description: URL où recevoir les notifications webhook
 *               communesToFollow:
 *                 type: array
 *                 items:
 *                   type: string
 *                   pattern: '^[0-9]{5}$'
 *                 example: ["33032", "33063"]
 *                 description: Liste des codes commune à suivre (vide = toutes)
 *               statusesToFollow:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [success, error, warning, info]
 *                 example: ["error", "warning"]
 *                 description: Types de statuts à suivre
 *               config:
 *                 type: object
 *                 description: Configuration avancée (timeout, retry, etc.)
 *     responses:
 *       201:
 *         description: Abonnement créé avec succès
 *       400:
 *         description: Données invalides
 *       409:
 *         description: Identifiant déjà utilisé
 */
app.post('/subscribers', analyticsMiddleware, async (req, res) => {
  try {
    // Validation des données d'abonnement (sans les champs auto-générés)
    const subscriberData = {
      identifier: req.body.identifier,
      webhookUrl: req.body.webhookUrl,
      communesToFollow: req.body.communesToFollow || [],
      statusesToFollow: req.body.statusesToFollow || ['error', 'warning'],
      config: req.body.config || null
    }
    
    // Validation avec un schéma allégé pour la création
    await object({
      identifier: string().trim().max(100).required(),
      webhookUrl: string().url().max(500).required(),
      communesToFollow: array().of(string().length(5)).default([]),
      statusesToFollow: array().of(string().oneOf(['success', 'error', 'warning', 'info'])).default(['error', 'warning']),
      config: object().nullable()
    }).validate(subscriberData)
    
    const subscriber = await createSubscriber(subscriberData)
    
    handleAPIResponse(res, 201, 'Abonnement créé avec succès', {
      id: subscriber.id,
      identifier: subscriber.identifier,
      isActive: subscriber.isActive
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      handleAPIResponse(res, 400, `Données invalides: ${error.message}`, {})
      return
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      handleAPIResponse(res, 409, 'Identifiant déjà utilisé', {})
      return
    }

    console.error('Erreur création abonnement:', error)
    handleAPIResponse(res, 500, 'Erreur interne du serveur', {})
  }
})

/**
 * @swagger
 * /api/alerts/subscribers/{identifier}:
 *   get:
 *     summary: Consulter un abonnement
 *     description: Récupère les détails d'un abonnement aux alertes
 *     tags:
 *       - 🚨 Alertes & Notifications
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         schema:
 *           type: string
 *           example: "mon-service-ban"
 *     responses:
 *       200:
 *         description: Abonnement trouvé
 *       404:
 *         description: Abonnement non trouvé
 *   delete:
 *     summary: Supprimer un abonnement
 *     description: Supprime un abonnement aux alertes. Nécessite une authentification.
 *     tags:
 *       - 🚨 Alertes & Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         schema:
 *           type: string
 *           example: "mon-service-ban"
 *     responses:
 *       200:
 *         description: Abonnement supprimé avec succès
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Abonnement non trouvé
 */
app.get('/subscribers/:identifier', analyticsMiddleware, async (req, res) => {
  try {
    const {identifier} = req.params
    
    const subscriber = await AlertSubscriber.findOne({
      where: {identifier},
      attributes: ['id', 'identifier', 'communesToFollow', 'statusesToFollow', 'isActive', 'lastNotificationAt', 'createdAt']
    })
    
    if (!subscriber) {
      handleAPIResponse(res, 404, 'Abonnement non trouvé', {})
      return
    }

    handleAPIResponse(res, 200, 'Abonnement trouvé', subscriber)
  } catch (error) {
    console.error('Erreur consultation abonnement:', error)
    handleAPIResponse(res, 500, 'Erreur interne du serveur', {})
  }
})

app.delete('/subscribers/:identifier', auth, async (req, res) => {
  try {
    const {identifier} = req.params
    
    const deletedCount = await AlertSubscriber.destroy({
      where: {identifier}
    })
    
    if (deletedCount === 0) {
      handleAPIResponse(res, 404, 'Abonnement non trouvé', {})
      return
    }

    handleAPIResponse(res, 200, 'Abonnement supprimé avec succès', {})
  } catch (error) {
    console.error('Erreur suppression abonnement:', error)
    handleAPIResponse(res, 500, 'Erreur interne du serveur', {})
  }
})

/**
 * @swagger
 * /api/alerts/revisions:
 *   post:
 *     summary: Enregistrer une nouvelle révision (usage interne)
 *     description: API interne pour enregistrer les statuts des révisions et déclencher les notifications. Nécessite une authentification.
 *     tags:
 *       - 🔧 Administration
 *     security:
 *       - bearerAuth: [] # Sécurisé avec un jeton Bearer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RevisionStatus'
 *     responses:
 *       201:
 *         description: Révision enregistrée et notifications envoyées
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé (authentification requise)
 *       500:
 *         description: Erreur interne du serveur
 */
app.post('/revisions', async (req, res) => {
  try {
    // Validation des données de révision (sans les champs auto-générés)
    const revisionData = {
      revisionId: req.body.revisionId,
      codeCommune: req.body.codeCommune,
      communeName: req.body.communeName || null,
      submissionDate: req.body.submissionDate,
      status: req.body.status,
      isIntegratedInBan: req.body.isIntegratedInBan || false,
      integrationDate: req.body.integrationDate || null,
      errorType: req.body.errorType || null,
      message: req.body.message || null,
      details: req.body.details || null,
      notificationsSent: []
    }
    
    // Validation avec un schéma allégé pour la création
    await object({
      revisionId: string().uuid().required(),
      codeCommune: string().trim().length(5).required(),
      communeName: string().trim().nullable(),
      submissionDate: date().required(),
      status: string().oneOf(['success', 'error', 'warning', 'info']).required(),
      isIntegratedInBan: boolean().default(false),
      integrationDate: date().nullable(),
      errorType: string().trim().max(100).nullable(),
      message: string().nullable(),
      details: object().nullable()
    }).validate(revisionData)
    
    // Enregistrer la révision
    const revision = await RevisionStatus.create(revisionData)
    
    // Envoyer les notifications webhook en arrière-plan
    setImmediate(() => {
      sendWebhookNotifications(revision).catch(error => {
        console.error('Erreur envoi notifications:', error)
      })
    })
    
    handleAPIResponse(res, 201, 'Révision enregistrée avec succès', {
      revisionId: revision.revisionId,
      status: revision.status
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      handleAPIResponse(res, 400, `Données invalides: ${error.message}`, {})
      return
    }

    console.error('Erreur enregistrement révision:', error)
    handleAPIResponse(res, 500, 'Erreur interne du serveur', {})
  }
})

export default app