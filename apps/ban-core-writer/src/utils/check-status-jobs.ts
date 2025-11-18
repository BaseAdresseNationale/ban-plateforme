/* eslint-disable no-unused-vars */
import { MessageCatalog, DistrictInfoBuilder } from './status-catalog.js';
import { logger } from "./logger.js";

async function checkSingleJob(statusID: string, maxWaitMinutes: number = 100): Promise<void> {
  const maxAttempts = maxWaitMinutes * 12;
  const BAN_API_URL = process.env.BAN_API_URL || '';
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${BAN_API_URL}/job-status/${statusID}`);
      const jobData = await response.json();
      
      if (jobData.response?.status === 'pending' || jobData.response?.status === 'processing') {
        logger.info(MessageCatalog.INFO.JOB_PENDING.template(statusID, attempt, maxAttempts));
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      
      if (jobData.response?.status === 'error') {
        let errorMessage = jobData.response?.message || 'Unknown error';
        
        if (jobData.response?.report?.data && jobData.response.report.data.length > 0) {
          const firstError = jobData.response.report.data[0];
          if (firstError?.report?.data && firstError.report.data.length > 0) {
            const firstDetailError = firstError.report.data[0];
            errorMessage = `${errorMessage} - ${firstDetailError}`;
          }
        }
        
        throw new Error(MessageCatalog.ERROR.JOB_FAILED.template(statusID, errorMessage));
      }
      
      if (jobData.response?.status === 'success') {
        logger.info(MessageCatalog.SUCCESS.JOB_COMPLETED.template(statusID, attempt * 5));
        return;
      }
      
      throw new Error(MessageCatalog.ERROR.JOB_UNKNOWN_STATUS.template(statusID, jobData.response?.status));
      
    } catch (error) {
      if (attempt === maxAttempts) {
        throw new Error(MessageCatalog.ERROR.JOB_TIMEOUT.template(statusID, maxWaitMinutes));
      }
      if (error instanceof Error && error.message.includes('Job') && (error.message.includes('failed') || error.message.includes('échoué'))) {
        throw error;
      }
    }
  }
  
  throw new Error(MessageCatalog.ERROR.JOB_TIMEOUT.template(statusID, maxWaitMinutes));
}

async function checkAllJobs(responseData: any, id: string): Promise<void> {
  const statusIDs: string[] = [];
  const DATA_TYPES = ['addresses', 'commonToponyms'];
  const ACTION_TYPES = ['add', 'update', 'delete'];

  // Parcourir tous les types de données et toutes les actions
  DATA_TYPES.forEach(dataType => {
    ACTION_TYPES.forEach(actionType => {
      if (responseData[dataType]?.[actionType]) {
        responseData[dataType][actionType].forEach((item: any) => {
          if (item.response?.statusID) {
            statusIDs.push(item.response.statusID);
          }
        });
      }
    });
  });

  if (statusIDs.length === 0) {
    return;
  }

  await Promise.all(statusIDs.map(statusID => checkSingleJob(statusID)));
}
export default checkAllJobs