import express from 'express'
import {UserPreference, District} from '../../util/sequelize.js'
import auth from '../../middleware/auth.js'
import proConnectMiddleware from '../../middleware/pro-connect.js'
import analyticsMiddleware from '../../middleware/analytics.js'
import {handleAPIResponse} from '../helper.js'

const app = new express.Router()

/**
 * @swagger
 * /api/user-preferences/favorites/list:
 *   post:
 *     summary: Récupérer les favoris de l'utilisateur courant (via POST pour passer la session)
 *     tags:
 *       - 👤 User Preferences
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Session info
 *     responses:
 *       200:
 *         description: Liste des favoris récupérée avec succès
 */
app.post('/favorites/list', auth, proConnectMiddleware, analyticsMiddleware, async (req, res) => {
  try {
    // L'utilisateur est identifié par le middleware via son cookie/token
    const userId = req.userID

    if (!userId) {
      handleAPIResponse(res, 401, 'Unauthorized', {})
      return
    }

    const user = await UserPreference.findByPk(userId)
    const favorites = user?.data?.favorites?.districts || []

    handleAPIResponse(res, 200, 'Favorites retrieved successfully', {favorites})
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

/**
 * @swagger
 * /api/user-preferences/favorites:
 *   post:
 *     summary: Ajouter un district aux favoris
 *     tags:
 *       - 👤 User Preferences
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               districtID:
 *                 type: string
 *                 description: UUID du district
 *     responses:
 *       201:
 *         description: Favori ajouté
 */
app.post('/favorites', auth, proConnectMiddleware, analyticsMiddleware, async (req, res) => {
  try {
    const userId = req.userID
    const {districtID} = req.body

    if (!userId) {
      handleAPIResponse(res, 401, 'Unauthorized', {})
      return
    }

    // Validation UUID
    const isUUID = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(districtID)
    if (!districtID || !isUUID) {
      handleAPIResponse(res, 400, 'Valid UUID districtID is required', {})
      return
    }

    // 1. Récupérer le district actif
    const district = await District.findByPk(districtID)
    if (!district || !district.isActive) {
      handleAPIResponse(res, 404, 'District not found or inactive', {})
      return
    }

    // 2. Récupérer ou créer l'utilisateur
    let user = await UserPreference.findByPk(userId)
    if (!user) {
      user = await UserPreference.create({id: userId, data: {favorites: {districts: []}}})
    }

    const currentFavorites = user.data?.favorites?.districts || []

    // Vérifications limites
    if (currentFavorites.length >= 1000) {
      handleAPIResponse(res, 400, 'Maximum 1000 favorites allowed', {})
      return
    }

    // Vérification doublon (sur l'UUID)
    if (currentFavorites.some(f => f.districtID === district.id)) {
      handleAPIResponse(res, 409, 'District already in favorites', {})
      return
    }

    // Création de l'objet favori
    const newFavorite = {
      districtID: district.id,
      codeCommune: district.meta?.insee?.cog || '00000',
      nomCommune: district.labels?.[0]?.value || 'Nom inconnu',
      addedAt: new Date().toISOString()
    }

    // Sauvegarde
    const newData = {
      ...user.data,
      favorites: {
        ...user.data?.favorites,
        districts: [...currentFavorites, newFavorite]
      }
    }

    user.data = newData
    await user.save()

    handleAPIResponse(res, 201, 'Favorite added successfully', {favorite: newFavorite})
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

/**
 * @swagger
 * /api/user-preferences/favorites/delete:
 *   post:
 *     summary: Supprimer un favori (Via POST pour passer le body)
 *     tags:
 *       - 👤 User Preferences
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               districtID:
 *                 type: string
 *     responses:
 *       200:
 *         description: Favori supprimé
 */
app.post('/favorites/delete', auth, proConnectMiddleware, analyticsMiddleware, async (req, res) => {
  try {
    const userId = req.userID
    const {districtID} = req.body

    if (!userId) {
      handleAPIResponse(res, 401, 'Unauthorized', {})
      return
    }

    if (!districtID) {
      handleAPIResponse(res, 400, 'districtID is required', {})
      return
    }

    const user = await UserPreference.findByPk(userId)
    if (!user) {
      handleAPIResponse(res, 404, 'User not found', {})
      return
    }

    const currentFavorites = user.data?.favorites?.districts || []
    const updatedFavorites = currentFavorites.filter(f => f.districtID !== districtID)

    if (currentFavorites.length === updatedFavorites.length) {
      handleAPIResponse(res, 404, 'Favorite not found', {})
      return
    }

    const newData = {
      ...user.data,
      favorites: {
        ...user.data?.favorites,
        districts: updatedFavorites
      }
    }

    user.data = newData
    await user.save()

    handleAPIResponse(res, 200, 'Favorite removed successfully', {})
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

export default app
