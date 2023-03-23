const {promisify} = require('util')
const workerFarm = require('worker-farm')

function getMaxConcurrentWorkers(options) {
  if (options.maxConcurrentWorkers) {
    return options.maxConcurrentWorkers
  }

  if (process.env.MAX_CONCURRENT_WORKERS) {
    return Number.parseInt(process.env.MAX_CONCURRENT_WORKERS, 10)
  }

  return require('os').cpus().length
}

async function runInParallel(modulePath, jobsData, workerFarmOptions = {}) {
  const maxConcurrentCallsPerWorker = process.env.MAX_CONCURRENT_CALLS_PER_WORKER
    ? Number.parseInt(process.env.MAX_CONCURRENT_CALLS_PER_WORKER, 10) : 1

  const computedWorkerFarmOptions = {
    maxConcurrentWorkers: getMaxConcurrentWorkers(workerFarmOptions),
    maxConcurrentCallsPerWorker,
    maxRetries: 0,
    workerOptions: {
      execArgv: [`--max-old-space-size=${workerFarmOptions.maxWorkerMemory || 4096}`]
    },
    ...workerFarmOptions
  }

  const farm = workerFarm(computedWorkerFarmOptions, modulePath)
  const runWorker = promisify(farm)

  return Promise.all(jobsData.map(jobData => runWorker(jobData)))
    .finally(() => workerFarm.end(farm))
}

module.exports = {runInParallel}
