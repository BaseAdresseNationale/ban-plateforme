import {purgeExpiredSessions} from '../session/models.js'

// Errors are rethrown so that Bull marks the job as failed instead of reporting a silent success.
export default async function purgeSessionsConsumer() {
  try {
    const count = await purgeExpiredSessions(new Date())
    console.log(`[purge-sessions] ${count} session(s) supprimée(s)`)
  } catch (error) {
    console.error(`[purge-sessions] échec : ${error.message}`)
    throw error
  }
}
