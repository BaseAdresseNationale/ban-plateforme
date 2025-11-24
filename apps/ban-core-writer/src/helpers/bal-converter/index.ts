/* eslint-disable no-unused-vars */
import type {
  Bal,
  BanCommonTopoIDWithHash,
  BanDistrict,
  BanDistrictID,
  BanIDWithHash,
  BanCommonTopoID,
  BanCommonToponym,
  BanAddressID,
  BanAddress,
} from '@ban/types';
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

const fetchDistrictsAndExtractData = async (bal: Bal) => {
  const districtIDs = bal.map(address => address.id_ban_commune as BanDistrictID);
  const districts = await getDistricts([...new Set(districtIDs)]);
  const districtsConfigs = new Map(districts.map(({ id, config }) => [id, config]));
  const { addresses, commonToponyms } = balToBan(bal, districtsConfigs);
  return { districts, addresses, commonToponyms };
};

const getReports = async (districts: any, addresses: Record<BanAddressID, BanAddress>, commonToponyms: Record<BanCommonTopoID, BanCommonToponym>) => {
  const dataForAddressReport = Object.values(addresses || {}).map(address => ({ id: address.id, hash: address.meta?.idfix?.hash }));
  const dataForCommonToponymReport = Object.values(commonToponyms || {}).map(commonToponym => ({ id: commonToponym.id, hash: commonToponym.meta?.idfix?.hash }));
  const [addressIdsReport, toponymsIdsReport] = await Promise.all([
    getAddressIdsReport(districts[0].id, dataForAddressReport),
    getCommonToponymIdsReport(districts[0].id, dataForCommonToponymReport),
  ]);
  return { addressIdsReport, toponymsIdsReport };
};

const checkDeletionThresholdEligibility = (districts: any) => {
  const district = districts.find((d:any) => d.id === districts[0].id);
  if (!district) return { shouldApplyThreshold: false, isMainDistrict: false };
  const isMainDistrict = district.meta?.insee?.isMain === true;
  const mainDistrictId = district?.meta?.insee?.mainId;
  return { shouldApplyThreshold: isMainDistrict, mainDistrictId};
};

const checkDeletionRatio = async (districtID: any, deletedAddressesCount: any, deletedToponymsCount: any) => {
  const { _, commonToponymCount, addressCount } = await getDistrictCountsFromID(districtID);
  let addressDeletionRate = 0, toponymDeletionRate = 0;

  if (addressCount > 0) addressDeletionRate = deletedAddressesCount / addressCount;
  if (commonToponymCount > 0) toponymDeletionRate = deletedToponymsCount / commonToponymCount;

  const addressesExceedThreshold = addressDeletionRate > DELETION_THRESHOLD;
  const toponymsExceedThreshold = toponymDeletionRate > DELETION_THRESHOLD;

  if (addressesExceedThreshold || toponymsExceedThreshold) {
    const maxRate = Math.max(addressDeletionRate, toponymDeletionRate);
    const errorDetails = [];
    if (addressesExceedThreshold) {
      errorDetails.push(`Addresses: ${(addressDeletionRate * 100).toFixed(1)}% (${deletedAddressesCount}/${addressCount})`);
    }
    if (toponymsExceedThreshold) {
      errorDetails.push(`Toponyms: ${(toponymDeletionRate * 100).toFixed(1)}% (${deletedToponymsCount}/${commonToponymCount})`);
    }
    
    const thresholdToDisplay = maxRate > DELETION_CRITICAL_THRESHOLD ? DELETION_CRITICAL_THRESHOLD * 100 : DELETION_THRESHOLD * 100;
    const errorMessage = MessageCatalog.ERROR.DELETION_THRESHOLD_EXCEEDED.template(districtID, thresholdToDisplay, `Exceeded: ${errorDetails.join(', ')}`);
    
    if (maxRate > DELETION_CRITICAL_THRESHOLD) throw new Error(errorMessage);
    throw new Error(errorMessage);
  }
};

const handleUnauthorizedItems = (addressIdsReport: any, toponymsIdsReport: any, districtID: any) => {
  const unauthorizedAddresses = addressIdsReport.idsUnauthorized;
  const unauthorizedToponyms = toponymsIdsReport.idsUnauthorized;

  if (unauthorizedAddresses.length > 0 || unauthorizedToponyms.length > 0) {
    throw new Error(MessageCatalog.ERROR.UNAUTHORIZED_OPERATION.template(districtID, unauthorizedAddresses, unauthorizedToponyms));
  }
};

const categorizeChanges = (addressIdsReport: any, toponymsIdsReport: any) => {
  const addressChanges = {
    add: Object.keys(addressIdsReport.idsToCreate).map(id => addressIdsReport.idsToCreate[id]),
    update: Object.keys(addressIdsReport.idsToUpdate).map(id => addressIdsReport.idsToUpdate[id]),
    delete: addressIdsReport.idsToDelete
  };

  const toponymChanges = {
    add: Object.keys(toponymsIdsReport.idsToCreate).map(id => toponymsIdsReport.idsToCreate[id]),
    update: Object.keys(toponymsIdsReport.idsToUpdate).map(id => toponymsIdsReport.idsToUpdate[id]),
    delete: toponymsIdsReport.idsToDelete
  };

  return { addressChanges, toponymChanges };
};

const processAddressChanges = async (addressChanges: any) => {
  const banAddressesToAddChunks = formatToChunks(addressChanges.add, CHUNK_SIZE);
  const banAddressesToUpdateChunks = formatToChunks(addressChanges.update, CHUNK_SIZE);
  const banAddressesIdsToDeleteChunks = formatToChunks(addressChanges.delete, CHUNK_SIZE);

  await Promise.all(banAddressesToAddChunks.map(chunk => createAddresses(chunk)));
  await Promise.all(banAddressesToUpdateChunks.map(chunk => updateAddresses(chunk)));
  await Promise.all(banAddressesIdsToDeleteChunks.map(chunk => deleteAddresses(chunk)));
};

const processToponymChanges = async (toponymChanges: any) => {
  const banToponymsToAddChunks = formatToChunks(toponymChanges.add, CHUNK_SIZE);
  const banToponymsToUpdateChunks = formatToChunks(toponymChanges.update, CHUNK_SIZE);
  const banToponymsIdsToDeleteChunks = formatToChunks(toponymChanges.delete, CHUNK_SIZE);

  await Promise.all(banToponymsToAddChunks.map(chunk => createCommonToponyms(chunk)));
  await Promise.all(banToponymsToUpdateChunks.map(chunk => updateCommonToponyms(chunk)));

  await Promise.all(banToponymsIdsToDeleteChunks.map(chunk => deleteCommonToponyms(chunk)));
};

const generateStatistics = (addressChanges: any, toponymChanges: any) => {
  const addressStats = {
    toAdd: addressChanges.add.length,
    toUpdate: addressChanges.update.length,
    toDelete: addressChanges.delete.length
  };
  const toponymStats = {
    toAdd: toponymChanges.add.length,
    toUpdate: toponymChanges.update.length,
    toDelete: toponymChanges.delete.length
  };
  const totalChanges = Object.values(addressStats).reduce((acc, val) => acc + val, 0) +
                      Object.values(toponymStats).reduce((acc, val) => acc + val, 0);
  
  return {
    totalChanges,
    districtID: null, // Placeholder for actual district ID
    addressStats,
    toponymStats
  };
};

export const sendBalToBan = async (bal: Bal) => {
  try {
    const { districts, addresses, commonToponyms } = await fetchDistrictsAndExtractData(bal);
    // Get addresses and toponyms reports from BAN to know which items to create, update or delete
    const { addressIdsReport, toponymsIdsReport } = await getReports(districts, addresses, commonToponyms);
    const { shouldApplyThreshold, mainDistrictId } = checkDeletionThresholdEligibility(districts);

    await handleUnauthorizedItems(addressIdsReport, toponymsIdsReport, districts[0].id);

    if (shouldApplyThreshold && mainDistrictId === districts[0].id) {
      await checkDeletionRatio(districts[0].id, addressIdsReport.idsToDelete.length, toponymsIdsReport.idsToDelete.length);
    }

    const { addressChanges, toponymChanges } = categorizeChanges(addressIdsReport, toponymsIdsReport);
    await processAddressChanges(addressChanges);
    await processToponymChanges(toponymChanges);

    const response = formatResponse([addressChanges, toponymChanges]);
    return {
      data: response,
      errors: [],
      hasErrors: false,
      statistics: {
        ...generateStatistics(addressChanges, toponymChanges),
        districtID: districts[0].id
      }
    };

  } catch (error: any) {
    return {
      data: null,
      errors: [{ type: 'ERROR', message: error.message }],
      hasErrors: true,
      statistics: null
    };
  }
};
