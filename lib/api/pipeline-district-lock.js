import {redis} from '../util/redis.cjs'

const LOCK_TTL_SECONDS = Number(process.env.API_PIPELINE_LOCK_TTL_SECONDS) || 3600

const lockKey = districtID => `ban:lock:pipeline:district:${districtID}`
const pendingKey = districtID => `ban:pipeline:district:${districtID}:pending`

export const acquirePipelineDistrictLock = async districtID => {
  try {
    const result = await redis.set(lockKey(districtID), '1', 'EX', LOCK_TTL_SECONDS, 'NX')
    if (result === 'OK') {
      console.log(`[pipeline-lock] Lock acquis pour district ${districtID}`)
      return true
    }

    console.log(`[pipeline-lock] Lock déjà pris pour district ${districtID}`)
    return false
  } catch (error) {
    console.warn(`[pipeline-lock] Redis indisponible pour district ${districtID}, traitement sans lock: ${error.message}`)
    return true
  }
}

export const releasePipelineDistrictLock = async districtID => {
  try {
    await redis.del(lockKey(districtID))
    await redis.del(pendingKey(districtID))
    console.log(`[pipeline-lock] Lock libéré pour district ${districtID}`)
  } catch (error) {
    console.warn(`[pipeline-lock] Impossible de libérer le lock district ${districtID}: ${error.message}`)
  }
}

export const setPipelinePendingCount = async (districtID, count) => {
  try {
    await redis.set(pendingKey(districtID), String(count), 'EX', LOCK_TTL_SECONDS)
    console.log(`[pipeline-lock] Pending ${count} jobs api pour district ${districtID}`)
  } catch (error) {
    console.warn(`[pipeline-lock] Impossible de définir pending pour district ${districtID}: ${error.message}`)
  }
}

export const hasPipelinePending = async districtID => {
  try {
    const value = await redis.get(pendingKey(districtID))
    return value !== null
  } catch {
    return false
  }
}

/** @returns {number|null} remaining count, or null if no pipeline pending key */
export const decrementPipelinePending = async districtID => {
  try {
    const remaining = await redis.decr(pendingKey(districtID))
    if (remaining < 0) {
      await redis.del(pendingKey(districtID))
      return 0
    }

    if (remaining === 0) {
      await redis.del(pendingKey(districtID))
    }

    return remaining
  } catch (error) {
    console.warn(`[pipeline-lock] Impossible de décrémenter pending district ${districtID}: ${error.message}`)
    return null
  }
}
