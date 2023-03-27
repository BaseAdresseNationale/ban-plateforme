const Metric = require('../models/metric.cjs')
const {computeStats} = require('../models/ban.cjs')

async function handle() {
  const stats = await computeStats()
  const date = (new Date()).toISOString().slice(0, 10)

  await Metric.setMetric('ban-stats', date, stats)
}

module.exports = handle
