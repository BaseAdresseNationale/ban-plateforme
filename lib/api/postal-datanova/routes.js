import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'
import auth from '../../middleware/auth.js'
import {handleAPIResponse} from '../helper.js'
import {updateMultipleDatanova} from './models.js'

const app = new express.Router()
app.use(express.json())

/**
 * @swagger
 * /api/datanova:
 *   put:
 *     summary: Mettre à jour plusieurs enregistrements dans Datanova
 *     description: Met à jour plusieurs enregistrements basés sur un tableau d'objets fournis dans le corps de la requête. Chaque objet doit contenir les propriétés `postalCodes`, `libelleAcheminementWithPostalCodes`, et `inseeCom`.
 *     tags:
 *       - 🔄 Mises à jour des codes postaux
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 postalCodes:
 *                   type: string
 *                   description: Code postal associé à l'enregistrement.
 *                   example: ["75001","75002"]
 *                 libelleAcheminementWithPostalCodes:
 *                   type: string
 *                   description: Libellé d'acheminement associé au code postal.
 *                   example: ["75001":"Paris 1er Arrondissement","75002":"Paris 2eme Arrondissement"]
 *                 inseeCom:
 *                   type: string
 *                   description: Code INSEE de la commune.
 *                   example: "75056"
 *     responses:
 *       200:
 *         description: Enregistrements mis à jour avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Records updated successfully"
 *                 totalUpdated:
 *                   type: integer
 *                   description: Nombre total d'enregistrements mis à jour avec succès.
 *       207:
 *         description: Mise à jour partielle.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "partial"
 *                 message:
 *                   type: string
 *                   example: "Partial success"
 *                 totalUpdated:
 *                   type: integer
 *                   description: Nombre total d'enregistrements mis à jour.
 *                 failedUpdates:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       inseeCom:
 *                         type: string
 *                         description: Code INSEE de la commune avec échec de mise à jour.
 *                         example: "75056"
 *                       error:
 *                         type: string
 *                         description: Détail de l'erreur survenue.
 *                         example: "Error message"
 *       400:
 *         description: Requête incorrecte.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "An array of items is required"
 *       500:
 *         description: Erreur interne du serveur.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */

app.put('/', auth, async (req, res) => {
  try {
    const items = req.body

    if (!Array.isArray(items) || items.length === 0) {
      handleAPIResponse(res, 400, 'An array of items is required', {})
      return
    }

    const results = await updateMultipleDatanova(items)

    const totalUpdated = results.reduce((acc, {updatedRowsCount}) => acc + updatedRowsCount, 0)
    const failedUpdates = results.filter(({updatedRowsCount, error}) => updatedRowsCount === 0 || error)

    if (failedUpdates.length > 0) {
      handleAPIResponse(res, 207, 'Partial success', {
        totalUpdated,
        failedUpdates: failedUpdates.map(({inseeCom, error}) => ({inseeCom, error}))
      })
      return
    }

    handleAPIResponse(res, 200, 'Records updated successfully', {totalUpdated})
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

export default app
