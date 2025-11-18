/* eslint-disable no-unused-vars */
import type { Bal } from '@ban/types';
import type {
  BanIDWithHash,
  BanCommonTopoIDWithHash,
} from '@ban/types';
import type { BanDistrict } from '@ban/types';
import type { BanDistrictID } from '@ban/types';
import {
  getDistricts,
  getAddressIdsReport,
  createAddresses,
  updateAddresses,
  deleteAddresses,
  getCommonToponymIdsReport,
  createCommonToponyms,
  updateCommonToponyms,
  deleteCommonToponyms,
  getDistrictCountsFromID
} from '../ban-api/index.js';
import { balToBan } from './helpers/index.js';
import { formatToChunks, formatResponse } from './helpers/format.js';
import { MessageCatalog } from '../../utils/status-catalog.js';


const CHUNK_SIZE = 1000;
const DELETION_THRESHOLD = Number(process.env.DELETION_THRESHOLD) || 0.25;
const DELETION_CRITICAL_THRESHOLD = Number(process.env.DELETION_CRITICAL_THRESHOLD) || 0.80;
export const sendBalToBan = async (bal: Bal) => {

  const errors = [];
  // Fetch District configurations
  const districtIDs = bal.map((address) => address.id_ban_commune as BanDistrictID);
  const districts: BanDistrict[] = await getDistricts([...new Set(districtIDs)]);
  const districtsConfigs = new Map(
    districts.map(({ id, config }) => [id, config])
  );

  // Extract data from BAL
  const { districtID, addresses, commonToponyms } = balToBan(bal, districtsConfigs);

  // Get addresses and toponyms reports
  const dataForAddressReport: BanIDWithHash[] = Object.values(
    addresses || {}
  ).map((address: any) => ({
    id: address.id,
    hash: address.meta?.idfix?.hash,
  }));
  const dataForCommonToponymReport: BanCommonTopoIDWithHash[] = Object.values(
    commonToponyms || {}
  ).map((commonToponym: any) => ({
    id: commonToponym.id,
    hash: commonToponym.meta?.idfix?.hash,
  }));

  // Get addresses and toponyms reports from BAN to know which items to create, update or delete
  const [addressIdsReport, toponymsIdsReport] = await Promise.all([
    getAddressIdsReport(districtID, dataForAddressReport),
    getCommonToponymIdsReport(districtID, dataForCommonToponymReport),
  ]);

// Check for unauthorized addresses and toponyms
const unauthorizedAddresses = addressIdsReport.idsUnauthorized;
const unauthorizedToponyms = toponymsIdsReport.idsUnauthorized;

const deletedAddresses = addressIdsReport.idsToDelete;
const deletedToponyms = toponymsIdsReport.idsToDelete;

// Check if we should apply deletion threshold (only for main districts)
let shouldApplyThreshold;
const district = districts.find(d => d.id === districtID);

if (!district) {
  shouldApplyThreshold = false;
} else {
const isMainDistrict = district?.meta?.insee?.isMain === true;
const mainDistrictId = district?.meta?.insee?.mainId;
shouldApplyThreshold = isMainDistrict && mainDistrictId === districtID;
}
// Checking the 25% deletion threshold relative to the existing total
// Calculating deletion ratio = deletions / existing_total
if (shouldApplyThreshold)
{
  // Get total counts from district
  const { _, commonToponymCount, addressCount } = await getDistrictCountsFromID(districtID);
  let addressDeletionRate = 0;
  let toponymDeletionRate = 0;

  if (addressCount > 0) {
    addressDeletionRate = deletedAddresses.length / addressCount;
  }

  if (commonToponymCount > 0) {
    toponymDeletionRate = deletedToponyms.length / commonToponymCount;
  }

  // Check: the deletion ratio must not exceed 25% of the total
  const addressesExceedThreshold = addressDeletionRate > DELETION_THRESHOLD;
  const toponymsExceedThreshold = toponymDeletionRate > DELETION_THRESHOLD;

  if (addressesExceedThreshold || toponymsExceedThreshold) {
    const maxRate = Math.max(addressDeletionRate, toponymDeletionRate);
    const errorDetails = [];
    
    if (addressesExceedThreshold) {
      errorDetails.push(`Addresses: ${(addressDeletionRate * 100).toFixed(1)}% (${deletedAddresses.length}/${addressCount})`);
    }
    
    if (toponymsExceedThreshold) {
      errorDetails.push(`Toponyms: ${(toponymDeletionRate * 100).toFixed(1)}% (${deletedToponyms.length}/${commonToponymCount})`);
    }

      const thresholdToDisplay = maxRate > DELETION_CRITICAL_THRESHOLD ? DELETION_CRITICAL_THRESHOLD * 100 : DELETION_THRESHOLD * 100;
      
      const errorMessage = MessageCatalog.ERROR.DELETION_THRESHOLD_EXCEEDED.template(
        districtID,
        thresholdToDisplay,
        `Exceeded: ${errorDetails.join(', ')}`
      );

      // Si > 80%, throw direct
      if (maxRate > DELETION_CRITICAL_THRESHOLD) {
        throw new Error(errorMessage);
      }
      errors.push({
        type: 'DELETION_THRESHOLD_EXCEEDED',
        message: errorMessage
      });
    }
  }
  
  // Check for unauthorized items
  if (unauthorizedAddresses.length > 0 || unauthorizedToponyms.length > 0) {
    throw new Error(MessageCatalog.ERROR.UNAUTHORIZED_OPERATION.template(districtID, unauthorizedAddresses, unauthorizedToponyms));
  }

  // Sort Addresses (Add/Update/Delete)
  const banAddressesToAdd = [];
  for (const addressId of addressIdsReport.idsToCreate) {
    banAddressesToAdd.push(addresses[addressId]);
  }
  const banAddressesToUpdate = [];
  for (const addressId of addressIdsReport.idsToUpdate) {
    banAddressesToUpdate.push(addresses[addressId]);
  }
  const banAddressesIdsToDelete = addressIdsReport.idsToDelete;

  // Split address arrays in chunks
  const banAddressesToAddChunks = formatToChunks(banAddressesToAdd, CHUNK_SIZE);
  const banAddressesToUpdateChunks = formatToChunks(
    banAddressesToUpdate,
    CHUNK_SIZE
  );
  const banAddressesIdsToDeleteChunks = formatToChunks(
    banAddressesIdsToDelete,
    CHUNK_SIZE
  );

  // Sort Toponyms (Add/Update/Delete)
  const banToponymsToAdd = [];
  for (const toponymId of toponymsIdsReport.idsToCreate) {
    banToponymsToAdd.push(commonToponyms[toponymId]);
  }
  const banToponymsToUpdate = [];
  for (const toponymId of toponymsIdsReport.idsToUpdate) {
    banToponymsToUpdate.push(commonToponyms[toponymId]);
  }
  const banToponymsIdsToDelete = toponymsIdsReport.idsToDelete;

const toponymStats = {
  toAdd: banToponymsToAdd.length,
  toUpdate: banToponymsToUpdate.length,
  toDelete: banToponymsIdsToDelete.length
};
const addressStats = {
  toAdd: banAddressesToAdd.length,
  toUpdate: banAddressesToUpdate.length,
  toDelete: banAddressesIdsToDelete.length
};

  const totalChanges = addressStats.toAdd + addressStats.toUpdate + addressStats.toDelete + 
                      toponymStats.toAdd + toponymStats.toUpdate + toponymStats.toDelete;

  // Split common toponyms arrays in chunks
  const banToponymsToAddChunks = formatToChunks(banToponymsToAdd, CHUNK_SIZE);
  const banToponymsToUpdateChunks = formatToChunks(
    banToponymsToUpdate,
    CHUNK_SIZE
  );
  const banToponymsIdsToDeleteChunks = formatToChunks(
    banToponymsIdsToDelete,
    CHUNK_SIZE
  );

  // Order is important here.
  // Need to handle common toponyms first (except delete), then adresses
  // We want to avoid creating addresses with a common toponym that does not exist yet

  // Common toponyms
  const responseCommonToponymsToAdd = await Promise.all(
    banToponymsToAddChunks.map((chunk) => createCommonToponyms(chunk))
  );
  const responseCommonToponymsToUpdate = await Promise.all(
    banToponymsToUpdateChunks.map((chunk) => updateCommonToponyms(chunk))
  );

  const responseCommonToponyms = [
    responseCommonToponymsToAdd,
    responseCommonToponymsToUpdate,
  ];

  // Addresses
  const responseAddressesToAdd = await Promise.all(
    banAddressesToAddChunks.map((chunk) => createAddresses(chunk))
  );
  const responseAddressesToUpdate = await Promise.all(
    banAddressesToUpdateChunks.map((chunk) => updateAddresses(chunk))
  );
  const responseAddressesToDelete = await Promise.all(
    banAddressesIdsToDeleteChunks.map((chunk) => deleteAddresses(chunk))
  );

  const responseAddresses = [
    responseAddressesToAdd,
    responseAddressesToUpdate,
    responseAddressesToDelete,
  ];

  // To delete common toponyms, we need to wait for addresses to be deleted first
  const responseCommonToponymsToDelete = await Promise.all(
    banToponymsIdsToDeleteChunks.map((chunk) => deleteCommonToponyms(chunk))
  );
  responseCommonToponyms.push(responseCommonToponymsToDelete);

  // Format response
  const allReponses = [responseAddresses, responseCommonToponyms];
  const result = formatResponse(allReponses);
  // Return data AND errors
return {
  data: result,
  errors: errors,
  hasErrors: errors.length > 0,
  statistics: {
    totalChanges,
    districtID,
    addressStats,
    toponymStats
  }
};
};
