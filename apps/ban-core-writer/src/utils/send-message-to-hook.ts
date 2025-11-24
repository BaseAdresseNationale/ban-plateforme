import fetch from 'node-fetch'

const { MESSAGE_WEBHOOK_URL, BAN_API_URL, BAN_API_TOKEN } = process.env

interface BasicRevisionData {
  message: string
  timestamp: string
  cog?: string
  districtName?: string | null
  districtId?: string | null
  status?: 'success' | 'error' | 'warning' | 'info'
}

function extractBasicInfo(
  message: string, 
  cog?: string, 
  districtName?: string | null, 
  districtId?: string | null, 
  status?: 'success' | 'error' | 'warning' | 'info'
): BasicRevisionData {
  const data: BasicRevisionData = {
    message,
    timestamp: new Date().toISOString(),
  }

  // Utiliser les paramètres fournis en priorité
  if (cog) data.cog = cog
  if (districtName) data.districtName = districtName
  if (districtId) data.districtId = districtId
  if (status) data.status = status

  // Si pas fournis, essayer d'extraire du message (fallback)
  if (!data.cog || !data.districtName) {
    const communeMatch = message.match(/(\w+(?:-\w+)*)\s+\((\d{5})\s+\//)
    if (communeMatch) {
      data.cog = data.cog || communeMatch[2]
      data.districtName = data.districtName || communeMatch[1]
    } else {
      const codeMatch = message.match(/(\d{5})/)
      if (codeMatch && !data.cog) {
        data.cog = codeMatch[1]
      }
    }
  }

  // Auto-détection du statut seulement si pas fourni explicitement
  if (!data.status) {
    if (message.includes('⚠️') ) data.status = 'warning'
    else if (message.includes('🔴') || message.includes('blocked') || message.includes('bloquée')) data.status = 'error'
    else if (message.includes('✅')) data.status = 'success'
    else data.status = 'info'
  }

  return data
}

async function sendToDatabase(basicData: BasicRevisionData, revisionId: string) {
  if (!BAN_API_URL || !BAN_API_TOKEN) {
    console.error('Configuration API BAN manquante')
    return
  }
  
  try {
    const payload: any = {
      revisionId,
      cog: basicData.cog || '00000',
      status: basicData.status || 'info',
      message: basicData.message
    }
    if (basicData.districtName) payload.districtName = basicData.districtName
    if (basicData.districtId) payload.districtId = basicData.districtId
    
    const response = await fetch(`${BAN_API_URL}/alerts/revisions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${BAN_API_TOKEN}` 
      },
      body: JSON.stringify(payload)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Erreur API BAN (${response.status}):`, errorText)
    }
  } catch (error) {
    console.error('Erreur envoi vers API BAN:', error)
  }
}

async function asyncSendMessageToWebHook(
  message: string,
  revisionId?: string,
  cog?: string,
  districtName?: string | null,
  districtId?: string | null,
  status?: 'success' | 'error' | 'warning' | 'info'
) {
  const basicData = extractBasicInfo(message, cog, districtName, districtId, status)
  
  // Envoyer en DB si on a un revisionId
  if (revisionId) {
    await sendToDatabase(basicData, revisionId)
  }
  
  // Continuer vers Mattermost
  if (!MESSAGE_WEBHOOK_URL) {
    console.error('No message web hook URL provided')
    return
  }
  
  try {
    const response = await fetch(MESSAGE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Id-fix',
        text: 
          `- **COG:** ${basicData.cog || '99999'}\n` +
          `- **Commune:** ${basicData.districtName || 'N/A'}\n` +
          `- **Status:** ${basicData.status?.toUpperCase() || 'INFO'}\n` +
          `- **Revision:** ${revisionId || 'N/A'}\n` +
          `- **Date:** ${basicData.timestamp}\n\n` +
          `- **Message :**\n${message}`
      }),
    })
    
    if (!response.ok) {
      console.error(`Failed to send message to web hook. Status: ${response.status}`)
    }
  } catch (error) {
    console.error('Error sending message to web hook:', error)
  }
}

async function sendWebhook(messageFunc: Function, revision: any, cog: string, districtName?: string | null, districtId?: string | null ,  explicitStatus?: 'success' | 'error' | 'warning' | 'info') {
  const message = messageFunc();
  // Utiliser le statut explicite s'il est fourni, sinon calculer automatiquement
  const status = explicitStatus || (
    message.startsWith('✅') ? 'success' 
    : message.startsWith('ℹ️') ? 'info'
    : message.startsWith('⚠️') ? 'warning' 
    : 'error'
  );
  await asyncSendMessageToWebHook(message, revision?.id, cog, districtName, districtId, status);
}

export default asyncSendMessageToWebHook
export { sendWebhook }