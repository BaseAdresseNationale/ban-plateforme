const Metric = require('../models/metric')
const {computeStats} = require('../models/ban')

async function handle() {
  const stats = await computeStats()
  const date = (new Date()).toISOString().slice(0, 10)

  await Metric.setMetric('ban-stats', date, stats)
}

module.exports = handle
