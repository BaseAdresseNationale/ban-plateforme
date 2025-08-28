import {RevisionStatus, AlertSubscriber} from './models.js'
import {Op} from 'sequelize'
import fetch from 'node-fetch'

export async function getCommuneStatus(codeCommune, limit = 10) {
  try {
    // Récupérer la dernière révision intégrée dans la BAN
    const lastIntegrated = await RevisionStatus.findOne({
      where: {
        codeCommune,
        isIntegratedInBan: true
      },
      order: [['integrationDate', 'DESC']]
    })

    // Récupérer les révisions récentes (soumises)
    const recentRevisions = await RevisionStatus.findAll({
      where: {
        codeCommune
      },
      order: [['submissionDate', 'DESC']],
      limit
    })

    if (recentRevisions.length === 0) {
      return null // Commune non trouvée
    }

    // Construire la réponse
    const response = {
      commune: {
        code: codeCommune,
        nom: recentRevisions[0].communeName || null
      },
      derniere_integration: lastIntegrated ? {
        revisionId: lastIntegrated.revisionId,
        date: lastIntegrated.integrationDate,
        status: lastIntegrated.status
      } : null,
      revisions_recentes: recentRevisions.map(revision => ({
        revisionId: revision.revisionId,
        status: revision.status,
        submissionDate: revision.submissionDate,
        isIntegratedInBan: revision.isIntegratedInBan,
        errorType: revision.errorType,
        message: revision.message,
        details: revision.details
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
    return await AlertSubscriber.create(data)
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
    const subscribers = await AlertSubscriber.findAll({
      where: {
        isActive: true,
        [Op.and]: [
          {
            [Op.or]: [
              { communesToFollow: { [Op.contains]: [revision.codeCommune] } },
              { communesToFollow: { [Op.eq]: [] } },
              { communesToFollow: { [Op.is]: null } }
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
          await subscriber.update({
            lastNotificationAt: new Date(),
            failedAttemptsCount: 0
          })

          return {
            subscriberId: subscriber.id,
            success: true,
            status: response.status
          }
        } else {
          await subscriber.update({
            failedAttemptsCount: subscriber.failedAttemptsCount + 1
          })

          console.error(`Échec webhook ${subscriber.identifier}: ${response.status}`)
          return {
            subscriberId: subscriber.id,
            success: false,
            status: response.status,
            error: `HTTP ${response.status}`
          }
        }
      } catch (error) {
        await subscriber.update({
          failedAttemptsCount: subscriber.failedAttemptsCount + 1
        })

        console.error(`Erreur webhook ${subscriber.identifier}:`, error.message)
        return {
          subscriberId: subscriber.id,
          success: false,
          error: error.message
        }
      }
    })

    const results = await Promise.all(notificationPromises)

    const notificationsSummary = results.map(result => ({
      subscriberId: result.subscriberId,
      success: result.success,
      timestamp: new Date().toISOString(),
      error: result.error || null
    }))

    await revision.update({
      notificationsSent: notificationsSummary
    })

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

export async function deactivateFailedSubscribers(maxFailedAttempts = 10) {
  try {
    const result = await AlertSubscriber.update(
      { isActive: false },
      {
        where: {
          failedAttemptsCount: { [Op.gte]: maxFailedAttempts },
          isActive: true
        }
      }
    )

    console.log(`${result[0]} abonnés désactivés pour trop d'échecs`)
    return result[0]
  } catch (error) {
    console.error('Erreur deactivateFailedSubscribers:', error)
    throw error
  }
}