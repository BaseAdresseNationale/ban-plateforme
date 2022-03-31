const Queue = require('bull')

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'

const queues = new Map()

function queue(queueName) {
  if (!queues.has(queueName)) {
    const queue = new Queue(queueName, REDIS_URL)

    queue.on('error', error => {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Impossible de se connecter à Redis (${REDIS_URL})`)
      }

      throw error
    })

    queues.set(queueName, queue)
  }

  return queues.get(queueName)
}

module.exports = queue
