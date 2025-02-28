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
 *       - UUID Generator
 *     parameters:
 *       - in: query
 *         name: quantity
 *         schema:
 *           type: integer
 *           example: 5
 *           default: 1
 *           minimum: 1
 *           maximum: 100000
 *         description: The number of UUIDs to generate.
 *     responses:
 *       200:
 *         description: A list of generated UUIDs.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                   format: date-time
 *                   description: The date and time of the response.
 *                 status:
 *                   type: string
 *                   example: success
 *                   description: The response status (success or error).
 *                 response:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of generated UUIDs.
 *       400:
 *         description: Invalid query parameters.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                   format: date-time
 *                   description: The date and time of the response.
 *                 status:
 *                   type: string
 *                   example: error
 *                   description: The response status (success or error).
 *                 message:
 *                   type: string
 *                   example: Quantity must be less than 100 000.
 *                   description: Error description.
 *                 response:
 *                   type: object
 *                   example: {}
 *                   description: Response content (empty in case of error).
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                   format: date-time
 *                   description: The date and time of the response.
 *                 status:
 *                   type: string
 *                   example: error
 *                   description: The response status (success or error).
 *                 message:
 *                   type: string
 *                   example: An internal error occurred.
 *                   description: Error message.
 *                 response:
 *                   type: object
 *                   example: {}
 *                   description: Response content (empty in case of error).
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
