import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'
import analyticsMiddleware from '../../middleware/analytics.js'

import {handleAPIResponse} from '../helper.js'
import {getUuids, uncollidUuids} from './helpers.js'

const app = new express.Router()

/**
 * @swagger
 * /api/ban-id:
 *   get:
 *     summary: Générer des UUID uniques
 *     description: Permet de générer un nombre spécifié d'UUID uniques, avec une limite maximale de 100 000 UUID.
 *     tags:
 *       - Générateur d'UUID
 *     parameters:
 *       - in: query
 *         name: quantity
 *         schema:
 *           type: integer
 *           example: 5
 *           default: 1
 *           minimum: 1
 *           maximum: 100000
 *         description: Le nombre d'UUID à générer.
 *     responses:
 *       200:
 *         description: Une liste d'UUID générés.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                   format: date-time
 *                   description: Date et heure de la réponse.
 *                 status:
 *                   type: string
 *                   example: success
 *                   description: Statut de la réponse (succès ou erreur).
 *                 response:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Liste des UUID générés.
 *       400:
 *         description: Paramètres de requête invalides.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                   format: date-time
 *                   description: Date et heure de la réponse.
 *                 status:
 *                   type: string
 *                   example: error
 *                   description: Statut de la réponse (succès ou erreur).
 *                 message:
 *                   type: string
 *                   example: La quantité doit être inférieure à 100 000.
 *                   description: Description de l'erreur.
 *                 response:
 *                   type: object
 *                   example: {}
 *                   description: Contenu de la réponse (vide en cas d'erreur).
 *       500:
 *         description: Erreur interne du serveur.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                   format: date-time
 *                   description: Date et heure de la réponse.
 *                 status:
 *                   type: string
 *                   example: error
 *                   description: Statut de la réponse (succès ou erreur).
 *                 message:
 *                   type: string
 *                   example: Une erreur interne est survenue.
 *                   description: Message d'erreur.
 *                 response:
 *                   type: object
 *                   example: {}
 *                   description: Contenu de la réponse (vide en cas d'erreur).
 */

app.get('/', analyticsMiddleware, async (req, res) => {
  try {
    const length = Number(req.query.quantity) || 1
    if (length > 100_000) {
      handleAPIResponse(res, 400, 'Quantity must be less than 100 000', {})
      return
    }

    const ids = await uncollidUuids(getUuids(length))
    handleAPIResponse(res, 200, 'Successfully generated UUIDs', ids)
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

export default app
