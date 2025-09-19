import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'
import {object, string, array} from 'yup'
import analyticsMiddleware from '../../middleware/analytics.js'
import auth from '../../middleware/auth.js'

import {handleAPIResponse} from '../helper.js'
import {Revision, Subscriber} from '../../util/sequelize.js'
import {getCommuneStatus, createSubscriber, sendWebhookNotifications} from './utils.js'

const app = new express.Router()
app.use(express.json())

/**
 * @swagger
 * /api/alerts/communes/{cog}/status:
 *   get:
 *     summary: Obtenir le statut d'une commune
 *     description: Récupère les révisions récentes d'une commune
 *     tags:
 *       - 🚨 Alertes & Notifications
 *     parameters:
 *       - in: path
 *         name: cog
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
 *       404:
 *         description: Commune non trouvée
 *       400:
 *         description: Code commune invalide
 */
app.get('/communes/:cog/status', analyticsMiddleware, async (req, res) => {
  try {
    const {cog} = req.params
    const limit = Number(req.query.limit) || 10

    if (!/^\d{5}$/.test(cog)) {
      handleAPIResponse(res, 400, 'Code commune invalide (5 chiffres requis)', {})
      return
    }

    if (limit > 100) {
      handleAPIResponse(res, 400, 'Limite maximum : 100 révisions', {})
      return
    }

    const communeStatus = await getCommuneStatus(cog, limit)

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
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - webhookUrl
 *             properties:
 *               subscriptionName:
 *                 type: string
 *                 maxLength: 255
 *                 example: "Mairie de Paris"
 *                 description: Nom ou dénomination sociale (optionnel)
 *               webhookUrl:
 *                 type: string
 *                 format: uri
 *                 example: "https://mon-service.fr/webhooks/ban-alerts"
 *                 description: URL où recevoir les notifications webhook
 *               districtsToFollow:
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
 *               createdBy:
 *                 type: string
 *                 description: sub ProConnect de l'utilisateur
 *               createdByEmail:
 *                 type: string
 *                 format: email
 *                 description: Email de l'utilisateur
 *     responses:
 *       201:
 *         description: Abonnement créé avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 *       409:
 *         description: URL déjà utilisée
 */
app.post('/subscribers', auth, analyticsMiddleware, async (req, res) => {
  try {
    const subscriberData = {
      subscriptionName: req.body.subscriptionName || null,
      webhookUrl: req.body.webhookUrl,
      districtsToFollow: req.body.districtsToFollow || [],
      statusesToFollow: req.body.statusesToFollow || ['error', 'warning'],
      createdBy: req.body.createdBy || null,
      createdByEmail: req.body.createdByEmail || null
    }

    // Validation mise à jour
    await object({
      subscriptionName: string().max(255).nullable(),
      webhookUrl: string().url().max(500).required(),
      districtsToFollow: array().of(string().length(5)).default([]),
      statusesToFollow: array().of(string().oneOf(['success', 'error', 'warning', 'info'])).default(['error', 'warning']),
      createdBy: string().nullable(),
      createdByEmail: string().email().nullable()
    }).validate(subscriberData)
    const subscriber = await createSubscriber(subscriberData)

    handleAPIResponse(res, 201, 'Abonnement créé avec succès', {
      id: subscriber.id,
      subscriptionName: subscriber.subscriptionName,
      webhookUrl: subscriber.webhookUrl,
      isActive: subscriber.isActive,
      createdAt: subscriber.createdAt
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      handleAPIResponse(res, 400, `Données invalides: ${error.message}`, {})
      return
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      handleAPIResponse(res, 409, 'URL webhook déjà utilisée', {})
      return
    }

    console.error('Erreur création abonnement:', error)
    handleAPIResponse(res, 500, 'Erreur interne du serveur', {})
  }
})

/**
 * @swagger
 * /api/alerts/subscribers:
 *   get:
 *     summary: Lister les abonnements d'un utilisateur
 *     description: Récupère tous les abonnements créés par un utilisateur
 *     tags:
 *       - 🚨 Alertes & Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: createdBy
 *         schema:
 *           type: string
 *         description: sub ProConnect pour filtrer les abonnements
 *     responses:
 *       200:
 *         description: Liste des abonnements
 *       401:
 *         description: Non autorisé
 */
app.get('/subscribers', auth, analyticsMiddleware, async (req, res) => {
  try {
    const {createdBy} = req.query
    const whereClause = createdBy ? {createdBy} : {}
    const subscribers = await Subscriber.findAll({
      where: whereClause,
      attributes: [
        'id',
        'subscriptionName',
        'webhookUrl',
        'districtsToFollow',
        'statusesToFollow',
        'isActive',
        'createdBy',
        'createdByEmail',
        'createdAt'
      ],
      order: [['createdAt', 'DESC']]
    })
    handleAPIResponse(res, 200, 'Abonnements récupérés avec succès', {
      subscriptions: subscribers,
      total: subscribers.length
    })
  } catch {
    handleAPIResponse(res, 500, 'Erreur interne du serveur', {})
  }
})

/**
 * @swagger
 * /api/alerts/subscribers/{id}:
 *   get:
 *     summary: Consulter un abonnement
 *     description: Récupère les détails d'un abonnement aux alertes
 *     tags:
 *       - 🚨 Alertes & Notifications
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Abonnement trouvé
 *       404:
 *         description: Abonnement non trouvé
 *   patch:
 *     summary: Modifier un abonnement
 *     description: Met à jour les propriétés d'un abonnement
 *     tags:
 *       - 🚨 Alertes & Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subscriptionName:
 *                 type: string
 *                 maxLength: 255
 *               isActive:
 *                 type: boolean
 *               statusesToFollow:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [success, error, warning, info]
 *               districtsToFollow:
 *                 type: array
 *                 items:
 *                   type: string
 *                   pattern: '^[0-9]{5}$'
 *     responses:
 *       200:
 *         description: Abonnement modifié avec succès
 *       404:
 *         description: Abonnement non trouvé
 *   delete:
 *     summary: Supprimer un abonnement
 *     description: Supprime un abonnement aux alertes
 *     tags:
 *       - 🚨 Alertes & Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Abonnement supprimé avec succès
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Abonnement non trouvé
 */
app.get('/subscribers/:id', analyticsMiddleware, async (req, res) => {
  try {
    const {id} = req.params

    const subscriber = await Subscriber.findByPk(id, {
      attributes: [
        'id',
        'subscriptionName',
        'webhookUrl',
        'districtsToFollow',
        'statusesToFollow',
        'isActive',
        'createdBy',
        'createdByEmail',
        'createdAt'
      ]
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

app.patch('/subscribers/:id', auth, analyticsMiddleware, async (req, res) => {
  try {
    const {id} = req.params
    const updateData = {}

    // Champs modifiables
    if (req.body.subscriptionName !== undefined) {
      updateData.subscriptionName = req.body.subscriptionName
    }

    if (req.body.isActive !== undefined) {
      updateData.isActive = req.body.isActive
    }

    if (req.body.statusesToFollow !== undefined) {
      updateData.statusesToFollow = req.body.statusesToFollow
    }

    if (req.body.districtsToFollow !== undefined) {
      updateData.districtsToFollow = req.body.districtsToFollow
    }

    // Validation des données à modifier
    if (Object.keys(updateData).length === 0) {
      handleAPIResponse(res, 400, 'Aucune donnée à modifier', {})
      return
    }

    const [updatedRows] = await Subscriber.update(updateData, {
      where: {id},
      returning: true
    })

    if (updatedRows === 0) {
      handleAPIResponse(res, 404, 'Abonnement non trouvé', {})
      return
    }

    const updatedSubscriber = await Subscriber.findByPk(id)

    handleAPIResponse(res, 200, 'Abonnement modifié avec succès', updatedSubscriber)
  } catch (error) {
    console.error('Erreur modification abonnement:', error)
    handleAPIResponse(res, 500, 'Erreur interne du serveur', {})
  }
})

app.delete('/subscribers/:id', auth, async (req, res) => {
  try {
    const {id} = req.params

    const deletedCount = await Subscriber.destroy({
      where: {id}
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
 *     description: API interne pour enregistrer les statuts des révisions et déclencher les notifications
 *     tags:
 *       - 🚨 Alertes & Notifications
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - revisionId
 *               - cog
 *               - status
 *             properties:
 *               revisionId:
 *                 type: string
 *               cog:
 *                 type: string
 *               districtName:
 *                 type: string
 *               districtId:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [success, error, warning, info]
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Révision enregistrée et notifications envoyées
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 */
app.post('/revisions', auth, async (req, res) => {
  try {
    const revisionData = {
      revisionId: req.body.revisionId,
      cog: req.body.cog,
      districtName: req.body.districtName || null,
      districtId: req.body.districtId || null,
      status: req.body.status,
      message: req.body.message || null
    }

    await object({
      revisionId: string().required(),
      cog: string().trim().length(5).required(),
      districtName: string().trim().nullable(),
      districtId: string().nullable(),
      status: string().oneOf(['success', 'error', 'warning', 'info']).required(),
      message: string().nullable()
    }).validate(revisionData)

    const revision = await Revision.create(revisionData)

    // Envoyer les notifications webhook en arrière-plan
    setImmediate(() => {
      sendWebhookNotifications(revision).catch(error => {
        console.error('Erreur envoi notifications:', error)
      })
    })

    handleAPIResponse(res, 201, 'Révision enregistrée avec succès', {
      id: revision.id,
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
