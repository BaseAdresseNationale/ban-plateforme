import ms from 'ms'
import {getAllJobStatusOlderThanDate, deleteJobStatus} from '../job-status/models.js'

const JOB_STATUS_LIMIT_DURATION = process.env.JOB_STATUS_LIMIT_DURATION || '90d'

export default async function cleanJobStatusConsumer() {
  try {
    const limitValidDate = new Date(Date.now() - ms(JOB_STATUS_LIMIT_DURATION))
    const jobStatus = await getAllJobStatusOlderThanDate(limitValidDate)
    if (jobStatus.length > 0) {
      await deleteJobStatus(jobStatus)
    }
  } catch (error) {
    console.error(error)
  }
}
