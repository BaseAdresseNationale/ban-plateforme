import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'
import auth from '../../middleware/auth.js'
import {handleAPIResponse} from '../helper.js'
import {replacePostalAreasPerDistrictCog} from './models.js'

const app = new express.Router()
app.use(express.json())

/**
 * @swagger
 * /district/cog/{cog}:
 *   put:
 *     summary: Mettre à jour les zones postales d'un district par le code COG
 *     description: Remplace les zones postales d'un district identifié par le code COG.
 *     tags:
 *       - Postal Area
 *     parameters:
 *       - in: path
 *         name: cog
 *         required: true
 *         description: Le code COG du district.
 *         schema:
 *           type: string
 *       - in: body
 *         name: postalAreas
 *         required: true
 *         description: Liste des zones postales à remplacer pour le district.
 *         schema:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               postalCode:
 *                 type: string
 *                 description: Code postal associé à la zone postale.
 *                 example: "75001"
 *               geometry:
 *                 type: object
 *                 description: Géométrie GeoJSON de la zone postale.
 *                 example: {"type": "Point", "coordinates": [2.3522, 48.8566]}
 *     responses:
 *       200:
 *         description: Zones postales mises à jour avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 createdCount:
 *                   type: integer
 *                   description: Nombre de zones postales créées.
 *                   example: 5
 *                 deletedCount:
 *                   type: integer
 *                   description: Nombre de zones postales supprimées.
 *                   example: 3
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
 *                   example: "Un tableau d'objets est requis"
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
 *                   example: "Erreur interne du serveur"
 */

app.put('/district/cog/:cog', auth, async (req, res) => {
  try {
    const {cog} = req.params
    const postalAreas = req.body

    if (!cog) {
      handleAPIResponse(res, 400, 'COG code is required', {})
      return
    }

    if (!Array.isArray(postalAreas) || postalAreas.length === 0) {
      handleAPIResponse(res, 400, 'An array of items is required', {})
      return
    }

    const {postalAreasCreatedCount, postalAreasDeletedCount} = await replacePostalAreasPerDistrictCog(cog, postalAreas)

    handleAPIResponse(res, 200, 'Postal areas updated', {
      createdCount: postalAreasCreatedCount,
      deletedCount: postalAreasDeletedCount,
    })
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

export default app
