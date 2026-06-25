import express from 'express'
import auth from '../../util/auth.js'
import { handleApiResponse } from '@ban/tools'
import {replacePostalAreasPerDistrictCog} from './model.js'

const app = express.Router()
app.use(express.json())

/**
 * @swagger
 * /district/cog/{cog}:
 *   put:
 *     summary: Mettre à jour les zones postales d'un district par le code COG
 *     description: Remplace les zones postales d'un district identifié par le code COG.
 *     tags:
 *       - 🔄 Mises à jour des codes postaux
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
 *               updatedBy:
 *                 type: string
 *                 description: Utilisateur qui a mis à jour la zone postale.
 *                 example: "jean.delarue@ign.fr"
 *               updateNote:
 *                 type: string
 *                 description: Note de mise à jour de la zone postale.
 *                 example: "maj cp code insee 61168 avec contours V3"
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
      handleApiResponse(res, 400, 'COG code is required', {})
      return
    }

    if (!Array.isArray(postalAreas) || postalAreas.length === 0) {
      handleApiResponse(res, 400, 'An array of items is required', {})
      return
    }
    if (!postalAreas.every(area => area.updateNote && area.updateNote)) {
      handleApiResponse(res, 400, 'Updated by and update note are required', {})
      return
    }
    const {postalAreasCreatedCount, postalAreasDeletedCount} = await replacePostalAreasPerDistrictCog(cog, postalAreas)

    handleApiResponse(res, 200, 'Postal areas updated', {
      createdCount: postalAreasCreatedCount,
      deletedCount: postalAreasDeletedCount,
    })
  } catch (error) {
    console.error(error)
    handleApiResponse(res, 500, 'Internal server error', {})
  }
})

export default app
