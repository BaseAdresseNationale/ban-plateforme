import {Revision, Subscriber} from './models.js'
import {Op} from 'sequelize'
import fetch from 'node-fetch'

export async function getCommuneStatus(cog, limit = 10) {
  try {
    // Récupérer les révisions récentes pour cette commune
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
    return await Subscriber.create(data)
  } catch (error) {
    console.error('Erreur createSubscriber:', error)
    throw error
  }
}

// Format générique pour tous les services
function buildWebhookPayload(revision) {
  return {
    text: revision.message
  }
}

export async function sendWebhookNotifications(revision) {
  try {
    // Récupérer les abonnés concernés par cette commune et ce statut
    const subscribers = await Subscriber.findAll({
      where: {
        isActive: true,
        [Op.and]: [
          {
            [Op.or]: [
              { districtsToFollow: { [Op.contains]: [revision.cog] } }, // Commune spécifique
              { districtsToFollow: { [Op.eq]: [] } } // Toutes les communes (array vide)
            ]
          },
          {
            statusesToFollow: { [Op.contains]: [revision.status] }
          }
        ]
      }
    })

    console.log(`Envoi notifications pour révision ${revision.revisionId} vers ${subscribers.length} abonnés`)

    const notificationPromises = subscribers.map(async (subscriber) => {
      try {
        // Payload générique pour tous les services
        const payload = buildWebhookPayload(revision)

        // Envoyer le webhook
        const response = await fetch(subscriber.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'BAN-Alerts/1.0'
          },
          body: JSON.stringify(payload),
          timeout: 10000
        })

        if (response.ok) {
          console.log(`✅ Webhook envoyé avec succès à ${subscriber.webhookUrl}`)
          return {
            subscriberId: subscriber.id,
            success: true,
            status: response.status
          }
        } else {
          console.error(`❌ Échec webhook ${subscriber.webhookUrl}: ${response.status}`)
          return {
            subscriberId: subscriber.id,
            success: false,
            status: response.status,
            error: `HTTP ${response.status}`
          }
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