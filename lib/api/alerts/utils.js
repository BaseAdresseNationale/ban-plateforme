import {Op} from 'sequelize'
import fetch from 'node-fetch'
import {Revision, Subscriber} from '../../util/sequelize.js'

const buildCommuneResponse = (cog, recentRevisions) => {
  const commune = {code: cog}

  const districtName = recentRevisions[0]?.districtName
  if (districtName && districtName.trim()) {
    commune.nom = districtName.trim()
  }

  return {
    commune,
    revisions_recentes: recentRevisions.map(revision => ({ // eslint-disable-line camelcase
      id: revision.id,
      revisionId: revision.revisionId,
      status: revision.status,
      districtName: revision.districtName,
      message: revision.message,
      createdAt: revision.createdAt
    }))
  }
}

export async function getCommuneStatus(cog, limit = 10) {
  try {
    const recentRevisions = await Revision.findAll({
      where: {cog},
      order: [['createdAt', 'DESC']],
      limit
    })

    if (recentRevisions.length === 0) {
      return null // Commune non trouvée
    }

    return buildCommuneResponse(cog, recentRevisions)
  } catch (error) {
    console.error('Erreur getCommuneStatus:', error)
    throw error
  }
}

const buildSubscriberData = data => ({
  subscriptionName: data.subscriptionName || null,
  webhookUrl: data.webhookUrl,
  districtsToFollow: data.districtsToFollow || [],
  statusesToFollow: data.statusesToFollow || ['error', 'warning'],

  isActive: data.isActive === undefined ? true : data.isActive,
  createdBy: data.createdBy || null,
  createdByEmail: data.createdByEmail || null
})

export async function createSubscriber(data) {
  try {
    const subscriberData = buildSubscriberData(data)
    return await Subscriber.create(subscriberData)
  } catch (error) {
    console.error('Erreur createSubscriber:', error)
    throw error
  }
}

function buildWebhookPayload(revision) {
  let msg = revision.message

  try {
    const parsed = JSON.parse(msg)
    msg = '```json\n' + JSON.stringify(parsed, null, 2) + '\n```'
  } catch {
    msg = `**${msg}**`
  }

  return {
    text:
      `- **COG:** ${revision.cog || '99999'}\n`
      + `- **Commune:** ${revision.districtName || 'N/A'}\n`
      + `- **Status:** ${revision.status.toUpperCase()}\n`
      + `- **Revision:** ${revision.revisionId}\n`
      + `- **Date:** ${revision.publishedAt || new Date().toISOString()}\n\n`
      + `- **Message :**\n${msg}`
  }
}

export async function sendWebhookNotifications(revision) {
  try {
    const subscribers = await Subscriber.findAll({
      where: {
        isActive: true,
        [Op.and]: [
          {
            [Op.or]: [
              {districtsToFollow: {[Op.contains]: [revision.cog]}},
              {districtsToFollow: {[Op.eq]: []}}
            ]
          },
          {
            statusesToFollow: {[Op.contains]: [revision.status]}
          }
        ]
      }
    })

    const notificationPromises = subscribers.map(async subscriber => {
      try {
        const payload = buildWebhookPayload(revision)

        const response = await fetch(subscriber.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'BAN-Alerts/1.0'
          },
          body: JSON.stringify(payload),
          timeout: 10_000 // Syntaxe ES2021 pour 10000ms
        })

        if (response.ok) {
          return {
            subscriberId: subscriber.id,
            success: true,
            status: response.status
          }
        }

        console.error(`Échec webhook ${subscriber.webhookUrl}: ${response.status}`)
        return {
          subscriberId: subscriber.id,
          success: false,
          status: response.status,
          error: `HTTP ${response.status}`
        }
      } catch (error) {
        console.error(`Erreur webhook ${subscriber.webhookUrl}:`, error.message)
        return {
          subscriberId: subscriber.id,
          success: false,
          error: error.message
        }
      }
    })

    const results = await Promise.all(notificationPromises)
    const successCount = results.filter(r => r.success).length
    return {
      total: results.length,
      success: successCount,
      failed: results.length - successCount,
      details: results
    }
  } catch (error) {
    console.error('Erreur sendWebhookNotifications:', error)
    throw error
  }
}

export async function getLatestAlerts(limit) {
  try {
    const latestAlerts = await Revision.sequelize.query(`
      WITH latest_revisions AS (
        SELECT DISTINCT ON (cog) 
          cog,
          "districtId",
          "districtName", 
          status, 
          message,
          "createdAt",
          "revisionId"
        FROM ban.revisions 
        WHERE status IN ('error', 'warning', 'success') 
        ORDER BY cog, "createdAt" DESC
      )
      SELECT * FROM latest_revisions 
      WHERE status = 'error'
      ORDER BY "createdAt" DESC
      LIMIT :limit
    `, {
      replacements: {limit},
      type: Revision.sequelize.QueryTypes.SELECT
    })

    return latestAlerts
  } catch (error) {
    console.error('Erreur getLatestAlerts:', error)
    throw error
  }
}
