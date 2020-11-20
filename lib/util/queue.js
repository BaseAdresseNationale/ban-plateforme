const Queue = require('bull')

const queues = new Map()

function queue(queueName) {
  if (!queues.has(queueName)) {
    queues.set(queueName, new Queue(queueName, process.env.REDIS_URL))
  }

  return queues.get(queueName)
}

module.exports = queue
