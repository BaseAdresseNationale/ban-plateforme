const fs = require('node:fs')
const express = require('express')
const Papa = require('papaparse')
const {snakeCase, mapKeys} = require('lodash')
const fetch = require('../util/fetch.cjs')
const currentDate = require('../util/local-current-date.cjs')
const {computeFilteredStats} = require('../models/ban.cjs')
const {
  getCommune,
  getCommuneData,
  getPopulatedVoie,
  getPopulatedNumero,
  getPopulatedCommune,
  getAdressesFeatures,
  getToponymesFeatures,
  getCommunesSummary,
} = require('../models/commune.cjs')
const Metric = require('../models/metric.cjs')
const {
  prepareAdresses: prepareAdressesLegacy,
  prepareLieuxDits,
} = require('../formatters/csv-legacy.cjs')
const {
  prepareAdresses: prepareAdressesBal,
  extractHeaders,
} = require('../formatters/csv-bal.cjs')
const w = require('../util/w.cjs')
const serveMvt = require('../util/serve-mvt.cjs')
const Commune = require('../models/commune.cjs')

const {
  ADMIN_TOKEN = '',
  API_IDFIX_URL = 'https://plateforme.adresse.data.gouv.fr/api-idfix',
  API_IDFIX_TOKEN = '',
  BAN_API_URL = '',
} = process.env

const prepareMethode = {
  'csv-legacy': {
    adresses: prepareAdressesLegacy,
    'lieux-dits': prepareLieuxDits,
  },
  'csv-bal': {
    adresses: prepareAdressesBal,
  },
}

const getLegacyTypeFromId = id => {
  switch (id.length) {
    case 5:
      return 'Commune'
    case 10:
    case 12:
      return 'Voie'
    default:
      return id.length >= 16 && 'Numéro'
  }
}

const sendToTracker = async ({url: paramUrl, download: paramDownload, ...params} = {}, ...args) => {
  const module = await import('../util/analytics-tracker.js')
  if (!module.sendToTracker) {
    console.warn('Legacy-routes: sendToTracker not found')
    return
  }

  const url = paramUrl && `${BAN_API_URL}${paramUrl}`
  const download = paramDownload && `${BAN_API_URL}${paramDownload}`

  return module.sendToTracker(
    {
      ...(url ? {url} : {}),
      ...(download ? {download} : {}),
      ...params
    },
    ...args)
}

const trackEventDefault = {
  category: 'API Legacy',
  value: 1,
}

const analyticsMiddleware = {
  authError(req, res, next) {
    const {url} = req
    const trackEvent = {
      ...trackEventDefault,
      action: 'Error',
      name: 'Erreur d’authentification',
    }
    sendToTracker({url, trackEvent})
    next?.()
  },
  codeCommuneError(req, res, next) {
    const {url} = req
    const trackEvent = {
      ...trackEventDefault,
      action: 'Error',
      name: 'Code commune inconnu',
    }
    sendToTracker({url, trackEvent})
    next?.()
  },
  composeCommune(req, res, next) {
    const {url} = req
    const {codeCommune} = req.commune
    const trackEvent = {
      ...trackEventDefault,
      action: 'Compose commune',
      name: codeCommune,
    }
    sendToTracker({url, trackEvent})
    next?.()
  },
  communesSummary(req, res, next) {
    const {url} = req
    const trackEvent = {
      ...trackEventDefault,
      action: 'Communes Summary',
      name: 'Display',
      value: 1,
    }
    sendToTracker({url, trackEvent})
    next?.()
  },
  exportCommunesSummary(req, res, next) {
    const {url} = req
    const trackEvent = {
      ...trackEventDefault,
      action: 'Communes Summary',
      name: 'Export to CSV',
      value: 1,
    }
    sendToTracker({url, trackEvent})
    next?.()
  },
  lookup(req, res, next) {
    const {url} = req
    const {id} = req.params
    const typeLookup = getLegacyTypeFromId(id)
    const trackEvent = {
      ...trackEventDefault,
      action: 'Lookup',
      name: typeLookup,
      value: 1,
    }
    sendToTracker({url, trackEvent})
    next?.()
  },
  downloadCommuneData(req, res, next) {
    const {url, commune = {}} = req
    const {codeCommune, downloadFormat, downloadType} = req.params
    const nomCommune = commune?.nomCommune
    const trackEvent = {
      category: 'Download',
      action: `Download Commune ${downloadType} (Format ${downloadFormat})`,
      name: `${codeCommune}${nomCommune ? ` - ${nomCommune}` : ''}`,
      value: 1,
    }
    sendToTracker({url, trackEvent})
    next?.()
  },

}

const ensureIsAdmin = (req, res, next) => {
  if (!ADMIN_TOKEN) {
    return res.status(401).send({
      code: 401,
      message: 'Aucun jeton d’administration n’a été défini',
    })
  }

  if (req.get('Authorization') !== `Token ${ADMIN_TOKEN}`) {
    analyticsMiddleware.authError(req, res)
    return res.status(401).send({
      code: 401,
      message: 'Vous n’êtes pas autorisé à effectuer cette action',
    })
  }

  next()
}

const app = express.Router()

app.param(
  'codeCommune',
  w(async (req, res, next) => {
    const {codeCommune} = req.params
    const commune = await getCommune(codeCommune)

    if (!commune) {
      analyticsMiddleware.codeCommuneError(req, res)
      return res
        .status(404)
        .send({code: 404, message: 'Commune non présente dans la BAN'})
    }

    req.commune = commune
    next()
  })
)

const acceptedBalVersion = new Set(['1.3', '1.4'])

// API Download Commune Data
app.get(
  '/ban/communes/:codeCommune/download/:downloadFormat/:downloadType',
  analyticsMiddleware.downloadCommuneData,
  w(async (req, res) => {
    const {codeCommune, downloadFormat, downloadType} = req.params
    const {version = '1.3'} = req.query
    const isCsvBal = downloadFormat === 'csv-bal'
    if (isCsvBal && version && !acceptedBalVersion.has(version)) {
      return res.status(404).send({
        code: 404,
        message: 'La version demandée n’est pas disponible',
      })
    }

    const {voies, numeros} = await getCommuneData(codeCommune)

    const data = prepareMethode
      ?.[downloadFormat]
      ?.[downloadType]?.({voies, numeros}, {includesAlt: true, version}) || null

    const headers = isCsvBal
      ? {
        header: true,
        columns: extractHeaders(data),
      } : {}

    const csvFile = Papa.unparse(data, {delimiter: ';', ...headers})

    const fileResponseName = `${downloadType}-${codeCommune}.csv`
    res
      .attachment(fileResponseName)
      .type('text/csv')
      .send(csvFile)
  })
)

/**
 * @swagger
 * /ban/communes/{codeCommune}/compose:
 *   post:
 *     summary: Demander la composition d'une commune via l'API ID-Fix
 *     description: Envoie une requête à l'API ID-Fix pour calculer la composition d'une commune donnée. Requiert les permissions administratives.
 *     tags:
 *       - Communes
 *     parameters:
 *       - name: codeCommune
 *         in: path
 *         required: true
 *         description: Code INSEE de la commune pour laquelle demander la composition.
 *         schema:
 *           type: string
 *           example: "75056"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               force:
 *                 type: boolean
 *                 description: Indique si la composition doit être forcée.
 *                 example: true
 *     responses:
 *       200:
 *         description: Commune récupérée avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 codeCommune:
 *                   type: string
 *                   description: Code INSEE de la commune.
 *                   example: "75056"
 *                 name:
 *                   type: string
 *                   description: Nom de la commune.
 *                   example: "Paris"
 *                 otherDetails:
 *                   type: object
 *                   description: Autres détails de la commune.
 *       500:
 *         description: Erreur interne du serveur.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal server error"
 */

// API-Legacy
app.post(
  '/ban/communes/:codeCommune/compose',
  ensureIsAdmin,
  w(async (req, res) => {
    const {codeCommune} = req.commune
    const {force} = req.body

    try {
      // Async Call to ID-Fix
      fetch(`${API_IDFIX_URL}/compute-from-cog/${codeCommune}?force=${force}`, {
        method: 'GET',
        headers: {
          'content-Type': 'application/json',
          Authorization: `Token ${API_IDFIX_TOKEN}`,
        },
      })
        .then(response => response.json())
        .then(idFixResponse => {
          console.log(idFixResponse)
        })
        .catch(error => {
          console.log(`[${currentDate()}][ERROR]`, error)
        })

      const commune = await getCommune(codeCommune)
      return res.send(commune)
    } catch (error) {
      const errMsg = `---
      ${new Date().toUTCString()}
      codeCommune : ${codeCommune}
      erreur : ${error}
      ---
      `.replace(/^(\s)*/gm, '')
      fs.appendFile('errorCompose.log', errMsg, error => {
        if (error) {
          throw error
        }
      })
      return res.sendStatus(500)
    }
  })
)

/**
 * @swagger
 * /api/legacy-compose/{codeCommune}/:
 *   post:
 *     summary: Demander la composition legacy pour une commune
 *     description: Envoie une requête de composition legacy pour une commune spécifique. Requiert les permissions administratives.
 *     tags:
 *       - Legacy Compose
 *     parameters:
 *       - name: codeCommune
 *         in: path
 *         required: true
 *         description: Code INSEE de la commune pour laquelle demander la composition legacy.
 *         schema:
 *           type: string
 *           example: "75056"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               force:
 *                 type: boolean
 *                 description: Indique si la composition doit être forcée.
 *                 example: true
 *               ignoreIdConfig:
 *                 type: boolean
 *                 description: Indique si la configuration d'identifiant doit être ignorée.
 *                 example: false
 *     responses:
 *       200:
 *         description: Requête de composition legacy envoyée avec succès.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Legacy compose asked for cog: 75056"
 *       500:
 *         description: Erreur interne du serveur.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal server error"
 */

app.post(
  '/api/legacy-compose/:codeCommune/',
  ensureIsAdmin,
  analyticsMiddleware.composeCommune,
  w(async (req, res) => {
    const {codeCommune} = req.commune
    const {force, ignoreIdConfig} = req.body

    try {
      // Async Call to ID-Fix
      await Commune.askComposition(codeCommune, {force}, ignoreIdConfig)
      return res.send(`Legacy compose asked for cog: ${codeCommune}`)
    } catch (error) {
      const errMsg = `---
      ${new Date().toUTCString()}
      codeCommune : ${codeCommune}
      erreur : ${error}
      ---
      `.replace(/^(\s)*/gm, '')
      fs.appendFile('errorCompose.log', errMsg, error => {
        if (error) {
          throw error
        }
      })
      return res.sendStatus(500)
    }
  })
)

/**
 * @swagger
 * /api/communes-summary:
 *   get:
 *     summary: Obtenir un résumé des communes
 *     description: Récupère un résumé des données des communes. Requiert l'authentification et applique un middleware d'analyse.
 *     tags:
 *       - Communes
 *     responses:
 *       200:
 *         description: Résumé des communes récupéré avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   codeCommune:
 *                     type: string
 *                     description: Code INSEE de la commune.
 *                     example: "75056"
 *                   name:
 *                     type: string
 *                     description: Nom de la commune.
 *                     example: "Paris"
 *                   population:
 *                     type: integer
 *                     description: Population de la commune.
 *                     example: 2148327
 *                   area:
 *                     type: number
 *                     format: float
 *                     description: Superficie de la commune en km².
 *                     example: 105.4
 *       500:
 *         description: Erreur interne du serveur.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal server error"
 */

app.get(
  '/api/communes-summary',
  analyticsMiddleware.communesSummary,
  w(async (req, res) => {
    const communesSummary = await getCommunesSummary()
    res.send(communesSummary)
  })
)
/**
 * @swagger
 * /api/communes-summary.csv:
 *   get:
 *     summary: Exporter un résumé des communes au format CSV
 *     description: Récupère un résumé des données des communes et les exporte sous forme de fichier CSV. Applique un middleware d'analyse.
 *     tags:
 *       - Communes
 *     responses:
 *       200:
 *         description: Fichier CSV contenant le résumé des communes.
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               example: |
 *                 region,departement,code_commune,nom_commune,population,id_revision,date_revision,type_composition,nb_lieux_dits,nb_voies,nb_numeros,nb_numeros_certifies,analyse_adressage_nb_adresses_attendues,analyse_adressage_ratio,analyse_adressage_deficit_adresses,composed_at
 *                 Île-de-France,75,75056,Paris,2148327,1,2023-12-01,full,50,1200,350000,300000,400000,0.87,1,2023-12-01
 *       500:
 *         description: Erreur interne du serveur.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal server error"
 */

app.get(
  '/api/communes-summary.csv',
  analyticsMiddleware.exportCommunesSummary,
  w(async (req, res) => {
    const communesSummary = (await getCommunesSummary()).map(c => {
      const s = {...c}

      /* eslint-disable camelcase */
      if (c.analyseAdressage) {
        s.analyse_adressage_nb_adresses_attendues
          = c.analyseAdressage.nbAdressesAttendues || ''
        s.analyse_adressage_ratio
          = 'ratio' in c.analyseAdressage ? c.analyseAdressage.ratio : ''
        s.analyse_adressage_deficit_adresses
          = 'deficitAdresses' in c.analyseAdressage
            ? (c.analyseAdressage.deficitAdresses
              ? '1'
              : '0')
            : ''
      }
      /* eslint-enable camelcase */

      return s
    })

    const columns = [
      'region',
      'departement',
      'code_commune',
      'nom_commune',
      'population',
      'id_revision',
      'date_revision',
      'type_composition',
      'nb_lieux_dits',
      'nb_voies',
      'nb_numeros',
      'nb_numeros_certifies',
      'analyse_adressage_nb_adresses_attendues',
      'analyse_adressage_ratio',
      'analyse_adressage_deficit_adresses',
      'composed_at',
    ]
    const csv = Papa.unparse(
      communesSummary.map(c => mapKeys(c, (v, k) => snakeCase(k))),
      {columns}
    )
    res.type('csv').send(csv)
  })
)

/**
 * @swagger
 * /lookup/{id}:
 *   get:
 *     summary: Recherche d'entité par identifiant
 *     description: Récupère une entité (commune, voie ou numéro) en fonction de l'identifiant fourni. Retourne les détails de l'entité ou une erreur si elle n'existe pas.
 *     tags:
 *       - Lookup
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Identifiant de l'entité à rechercher.
 *     responses:
 *       200:
 *         description: Entité trouvée avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: Détails de l'entité (commune, voie ou numéro).
 *       400:
 *         description: Type d’identifiant inconnu.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 400
 *                 message:
 *                   type: string
 *                   example: "Type d’identifiant inconnu"
 *       404:
 *         description: Entité non trouvée.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 404
 *                 message:
 *                   type: string
 *                   example: "La commune n’existe pas"
 *       500:
 *         description: Erreur interne du serveur.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */

app.get(
  '/lookup/:id',
  analyticsMiddleware.lookup,
  w(async (req, res) => {
    const {id} = req.params
    const typeID = getLegacyTypeFromId(id)

    if (typeID === 'Commune') {
      const commune = await getPopulatedCommune(id)

      if (!commune) {
        return res
          .status(404)
          .send({code: 404, message: 'La commune n’existe pas'})
      }

      return res.send(commune)
    }

    if (typeID === 'Voie') {
      const voie = await getPopulatedVoie(id)

      if (!voie) {
        return res
          .status(404)
          .send({code: 404, message: 'La voie n’existe pas'})
      }

      return res.send(voie)
    }

    if (typeID === 'Numéro') {
      const numero = await getPopulatedNumero(id)

      if (!numero) {
        return res
          .status(404)
          .send({code: 404, message: 'Le numéro n’existe pas'})
      }

      return res.send(numero)
    }

    res.status(400).send({code: 400, message: 'Type d’identifiant inconnu'})
  })
)

/**
 * @swagger
 * /ban/stats:
 *   get:
 *     summary: Récupération des statistiques de la BAN
 *     description: Renvoie les dernières statistiques de la Base Adresse Nationale (BAN).
 *     tags:
 *       - BAN
 *     responses:
 *       200:
 *         description: Statistiques récupérées avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 value:
 *                   type: object
 *                   description: Dernières statistiques de la BAN.
 *       500:
 *         description: Erreur interne du serveur.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */

/**
 * @swagger
 * /tiles/ban/{z}/{x}/{y}.pbf:
 *   get:
 *     summary: Récupère les tuiles MVT pour les adresses et toponymes
 *     description: Récupère les données MVT des adresses et toponymes pour un niveau de zoom et des coordonnées spécifiques.
 *     tags:
 *       - Tiles
 *     parameters:
 *       - in: path
 *         name: z
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 10
 *           maximum: 14
 *         description: Niveau de zoom de la tuile (entre 10 et 14).
 *       - in: path
 *         name: x
 *         required: true
 *         schema:
 *           type: integer
 *         description: Coordonnée X de la tuile.
 *       - in: path
 *         name: y
 *         required: true
 *         schema:
 *           type: integer
 *         description: Coordonnée Y de la tuile.
 *     responses:
 *       200:
 *         description: Tuiles MVT récupérées avec succès.
 *         content:
 *           application/x-protobuf:
 *             schema:
 *               type: string
 *               format: byte
 *               description: Données MVT des adresses et toponymes.
 *       404:
 *         description: Tuile non trouvée ou niveau de zoom invalide.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 404
 *                 message:
 *                   type: string
 *                   example: "Tuile non trouvée ou niveau de zoom invalide"
 *       500:
 *         description: Erreur interne du serveur.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: "Erreur interne du serveur"
 */

// BAN Stats
app.get(
  '/ban/stats',
  w(async (req, res) => {
    const metric = await Metric.getLastMetric('ban-stats')
    res.send(metric.value)
  })
)

/**
 * @swagger
 * /ban/stats:
 *   get:
 *     summary: Récupération des statistiques de la BAN
 *     description: Renvoie les dernières statistiques de la Base Adresse Nationale (BAN).
 *     tags:
 *       - BAN
 *     responses:
 *       200:
 *         description: Statistiques récupérées avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 value:
 *                   type: object
 *                   description: Dernières statistiques de la BAN.
 *       500:
 *         description: Erreur interne du serveur.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
app.post(
  '/ban/stats',
  w(async (req, res) => {
    const {codesCommune} = req.body
    if (!codesCommune || codesCommune.length === 0) {
      return res
        .status(404)
        .send({code: 404, message: 'Paramètre codesCommune manquant ou invalide'})
    }

    try {
      const stats = await computeFilteredStats(codesCommune)
      res.send(stats)
    } catch (error) {
      console.error(error)
      res.status(500).send({code: 500, message: 'Une erreur est survenu lors du calcul des statistiques'})
    }
  }))

// BAN Carto Tiles
app.get(
  '/tiles/ban/:z/:x/:y.pbf',
  w(async (req, res) => {
    req.x = Number.parseInt(req.params.x, 10)
    req.y = Number.parseInt(req.params.y, 10)
    req.z = Number.parseInt(req.params.z, 10)

    if (req.z < 10 || req.z > 14) {
      return res.sendStatus(404)
    }

    const [adresses, toponymes] = await Promise.all([
      getAdressesFeatures(req.z, req.x, req.y),
      getToponymesFeatures(req.z, req.x, req.y),
    ])

    req.layersFeatures = {adresses, toponymes}

    await serveMvt(req, res)
  })
)

module.exports = app
