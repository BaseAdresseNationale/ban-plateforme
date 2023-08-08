
import {Op} from 'sequelize'
import {JobStatus} from '../../util/sequelize.js'

export async function getJobStatus(statusID) {
  return JobStatus.findOne({where: {id: statusID}, raw: true})
}

export async function getAllJobStatusOlderThanDate(date) {
  return JobStatus.findAll({where: {createdAt: {[Op.lte]: date}}, raw: true})
}

export async function setJobStatus(statusID, content) {
  return JobStatus.create({id: statusID, ...content})
}

export async function deleteJobStatus(jobStatus) {
  const jobStatusIDs = jobStatus.map(status => status.id)
  return JobStatus.destroy({where: {id: jobStatusIDs}})
}
