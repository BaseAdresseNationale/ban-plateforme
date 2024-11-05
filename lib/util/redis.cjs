const Redis = require('ioredis')

const {REDIS_URL} = process.env
const REDIS_MAXMEMORY = process.env.REDIS_MAXMEMORY || '5gb'
const REDIS_MAXMEMORY_POLICY = process.env.REDIS_MAXMEMORY_POLICY || 'allkeys-lfu'

const redis = new Redis(REDIS_URL)

async function configureRedis() {
  try {
    // Set max memory limit
    await redis.config('SET', 'maxmemory', REDIS_MAXMEMORY)

    // Set the eviction policy when the memory limit is reached
    await redis.config('SET', 'maxmemory-policy', REDIS_MAXMEMORY_POLICY)

    console.log('Redis memory settings configured : maxmemory =', REDIS_MAXMEMORY, ', maxmemory-policy =', REDIS_MAXMEMORY_POLICY)
  } catch (error) {
    console.error('Failed to set Redis config:', error)
  }
}

module.exports = {redis, configureRedis}
