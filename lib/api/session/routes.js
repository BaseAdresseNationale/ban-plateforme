import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'
import auth from '../../middleware/auth.js'
import {handleAPIResponse} from '../helper.js'
import {addSession} from './models.js'

const app = new express.Router()
app.use(express.json())

/**
 * @swagger
 * /api/session/:
 *   post:
 *     summary: Créer une nouvelle session
 *     description: |
 *       Enregistre une session ProConnect (claims du jeton d'identité) pour l'utiliser ensuite
 *       sur les routes protégées par session. Une session identique déjà enregistrée n'est pas dupliquée.
 *       Cette action requiert une authentification avec un jeton Bearer.
 *     tags:
 *       - 📜 Sessions
 *     security:
 *       - bearerAuth: [] # Sécurisé avec un jeton Bearer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sub
 *               - email
 *               - siret
 *               - aud
 *               - exp
 *               - iat
 *               - iss
 *             properties:
 *               sub:
 *                 type: string
 *                 example: "a950efd3-69e7-41df-b5d8-a47dc660b66e"
 *               email:
 *                 type: string
 *                 example: "agent@mairie.example"
 *               siret:
 *                 type: string
 *                 example: "21600627000017"
 *               aud:
 *                 type: string
 *               exp:
 *                 type: string
 *                 example: "1764000000"
 *               iat:
 *                 type: string
 *                 example: "1763996400"
 *               iss:
 *                 type: string
 *                 example: "https://proconnect.example"
 *               name:
 *                 type: string
 *               givenName:
 *                 type: string
 *               familyName:
 *                 type: string
 *               usualName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Session créée.
 *       200:
 *         description: Session déjà enregistrée.
 *       400:
 *         description: Champ obligatoire manquant.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "sub is required"
 *       401:
 *         description: Non autorisé (authentification requise).
 *       500:
 *         description: Erreur interne du serveur.
 */

app.post('/', auth, async (req, res) => {
  try {
    const {
      sub,
      email,
      siret,
      aud,
      exp,
      iat,
      iss,
    } = req.body

    if (!sub) {
      handleAPIResponse(res, 400, 'sub is required', {})
      return
    }

    if (!email) {
      handleAPIResponse(res, 400, 'email is required', {})
      return
    }

    if (!siret) {
      handleAPIResponse(res, 400, 'siret is required', {})
      return
    }

    if (!aud) {
      handleAPIResponse(res, 400, 'aud is required', {})
      return
    }

    if (!exp) {
      handleAPIResponse(res, 400, 'exp is required', {})
      return
    }

    if (!iat) {
      handleAPIResponse(res, 400, 'iat is required', {})
      return
    }

    if (!iss) {
      handleAPIResponse(res, 400, 'iss is required', {})
      return
    }

    const data = {...req.body}
    const created = await addSession(data)
    if (!created) {
      handleAPIResponse(res, 200, 'Session already exists', {})
      return
    }

    handleAPIResponse(res, 201, 'Session created', {})
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

export default app
