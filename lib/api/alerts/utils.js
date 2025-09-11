import {Op} from 'sequelize'
import fetch from 'node-fetch'
import {Revision, Subscriber} from './models.js'

export async function getCommuneStatus(cog, limit = 10) {
  try {
    const recentRevisions = await Revision.findAll({
      where: {
        cog
      },
      order: [['createdAt', 'DESC']],
      limit
    })

    if (recentRevisions.length === 0) {
      return null // Commune non trouvée
    }

    // Construire la réponse simplifiée
    const response = {
      commune: {
        code: cog,
        nom: recentRevisions[0].districtName || null
      },
      revisions_recentes: recentRevisions.map(revision => ({
        id: revision.id,
        revisionId: revision.revisionId,
        status: revision.status,
        districtName: revision.districtName,
        message: revision.message,
        createdAt: revision.createdAt
      }))
    }

    return response
  } catch (error) {
    console.error('Erreur getCommuneStatus:', error)
    throw error
  }
}

export async function createSubscriber(data) {
  try {
    // Valider que les champs obligatoires sont présents
    const subscriberData = {
      subscriptionName: data.subscriptionName || null,
      webhookUrl: data.webhookUrl,
      districtsToFollow: data.districtsToFollow || [],
      statusesToFollow: data.statusesToFollow || ['error', 'warning'],
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdBy: data.createdBy || null,
      createdByEmail: data.createdByEmail || null
    }

    return await Subscriber.create(subscriberData)
  } catch (error) {
    console.error('Erreur createSubscriber:', error)
    throw error
  }
}
function buildWebhookPayload(revision) {
  let msg = revision.message;

  // Si c'est du JSON, on l'affiche joliment formaté
  try {
    const parsed = JSON.parse(msg);
    msg = "```json\n" + JSON.stringify(parsed, null, 2) + "\n```";
  } catch (e) {
    // pas du JSON → on laisse tel quel
    msg = `**${msg}**`;
  }

  return {
    text:
      `- **COG:** ${revision.cog || '99999'}\n` +
      `- **Commune:** ${revision.districtName || 'N/A'}\n` +
      `- **Status:** ${revision.status.toUpperCase()}\n` +
      `- **Revision:** ${revision.revisionId}\n` +
      `- **Date:** ${revision.publishedAt || new Date().toISOString()}\n\n` +
      `- **Message :**\n${msg}`
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

    console.log(`Envoi notifications pour révision ${revision.revisionId} vers ${subscribers.length} abonnés`)

    const notificationPromises = subscribers.map(async subscriber => {
      try {
        const payload = buildWebhookPayload(revision, subscriber.webhookUrl)

        const response = await fetch(subscriber.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'BAN-Alerts/1.0'
          },
          body: JSON.stringify(payload),
          timeout: 10_000
        })

        if (response.ok) {
          console.log(`✅ Webhook envoyé avec succès à ${subscriber.webhookUrl} (${subscriber.subscriptionName || 'Sans nom'})`)
          return {
            subscriberId: subscriber.id,
            success: true,
            status: response.status
          }
        }

        console.error(`❌ Échec webhook ${subscriber.webhookUrl}: ${response.status}`)
        return {
          subscriberId: subscriber.id,
          success: false,
          status: response.status,
          error: `HTTP ${response.status}`
        }
      } catch (error) {
        console.error(`❌ Erreur webhook ${subscriber.webhookUrl}:`, error.message)
        return {
          subscriberId: subscriber.id,
          success: false,
          error: error.message
        }
      }
    })

    const results = await Promise.all(notificationPromises)
    const successCount = results.filter(r => r.success).length
    console.log(`Notifications envoyées: ${successCount}/${results.length} succès`)

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
