const {promisify} = require('util')
const workerFarm = require('worker-farm')

async function runInParallel(modulePath, jobsData, workerFarmOptions = {}) {
  const maxConcurrentWorkers = process.env.MAX_CONCURRENT_WORKERS
    ? Number.parseInt(process.env.MAX_CONCURRENT_WORKERS, 10) : require('os').cpus().length
  const maxConcurrentCallsPerWorker = process.env.MAX_CONCURRENT_CALLS_PER_WORKER
    ? Number.parseInt(process.env.MAX_CONCURRENT_CALLS_PER_WORKER, 10) : 1

  const computedWorkerFarmOptions = {
    maxConcurrentWorkers,
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
