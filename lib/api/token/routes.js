import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'
import {customAlphabet} from 'nanoid'
import auth from '../../middleware/auth.js'
import analyticsMiddleware from '../../middleware/analytics.js'
import {redis} from '../../util/redis.cjs'
import {transporter} from '../../util/smtp.js'
import {handleAPIResponse} from '../helper.js'

const app = new express.Router()

const nanoid = customAlphabet('123456789ABCDEFGHJKMNPQRSTVWXYZ', 6)

const TOKEN_EXPIRY_TIME = process.env.TOKEN_EXPIRY_TIME || 7200
const {MAIL_SENDER} = process.env

const generateMailContent = token => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authentification - Base Adresse Nationale</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f6f6f6;
      color: #333;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      padding-bottom: 20px;
    }
    .header img {
      max-width: 100px;
    }
    .content {
      font-size: 16px;
      line-height: 1.6;
    }
    .token {
      display: block;
      text-align: center;
      font-size: 24px;
      font-weight: bold;
      color: #004085;
      background-color: #e9ecef;
      padding: 10px;
      border-radius: 4px;
      margin: 20px 0;
    }
    .footer {
      font-size: 12px;
      color: #666;
      text-align: center;
      margin-top: 20px;
    }
    .footer a {
      color: #004085;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://adresse.data.gouv.fr/images/logos/BAN.png" alt="Base Adresse Nationale">
    </div>
    <div class="content">
      <p>Bonjour,</p>
      <p>Vous avez demandé un accès sécurisé pour vous connecter à votre Espace "Commune" sur le site de la <strong>Base Adresse Nationale</strong> via <a href="https://adresse.data.gouv.fr">adresse.data.gouv.fr</a>.</p>
      <p>Veuillez utiliser le code de vérification ci-dessous pour procéder à votre authentification :</p>
      
      <div class="token">${token}</div>

      <p>Ce code est valide pendant <strong>${TOKEN_EXPIRY_TIME / 3600} heures</strong>. Passé ce délai, vous devrez en générer un nouveau pour vous connecter.</p>
      <p>Si vous n'avez pas fait cette demande, veuillez ignorer cet email. Votre adresse restera en sécurité.</p>
    </div>
    <div class="footer">
      <p>Merci de faire confiance à la Base Adresse Nationale.<br>
      <p>&copy; 2024 Base Adresse Nationale - Tous droits réservés.</p>
    </div>
  </div>
</body>
</html>
`

const defaultMailOptions = {
  from: MAIL_SENDER,
  subject: 'Base Adresse Nationale - Votre token de connexion',
}

app.post('/', auth, analyticsMiddleware, async (req, res) => {
  try {
    const {email} = req.body

    if (!email) {
      handleAPIResponse(res, 400, 'Email address is required.', {})
    }

    // Const existingToken = await redis.get(email)
    // if (existingToken) {
    //   handleAPIResponse(res, 401, 'Token already sent. Please check your email.', {})
    // }

    // Generate a token and set expiry time
    const token = nanoid()

    // Store the token in Redis with expiry time
    await redis.set(email, token, 'EX', TOKEN_EXPIRY_TIME)

    // Send the token via email
    const mailOptions = {
      ...defaultMailOptions,
      to: email,
      html: generateMailContent(token),
    }

    await transporter.sendMail(mailOptions)

    handleAPIResponse(res, 200, 'Token generated and sent to email.', {})
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

export default app
