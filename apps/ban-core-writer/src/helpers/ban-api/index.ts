import type {
  BanAddressID,
  BanCommonTopoID,
  BanDistrictID,
} from '@ban/types';
import type {
  BanIDWithHash,
  BanCommonTopoIDWithHash,
} from '@ban/types';
import HandleHTTPResponse from '../../utils/http-request-handler.js';

import type { BanAddresses, BanCommonToponyms } from '@ban/types';
import { MessageCatalog } from '../../utils/status-catalog.js';

const BAN_API_TOKEN = process.env.BAN_API_TOKEN || '';
const BAN_API_URL = process.env.BAN_API_URL || '';
const BAN_LEGACY_API_TOKEN = process.env.BAN_LEGACY_API_TOKEN;

const defaultHeader = {
  Authorization: `Token ${BAN_API_TOKEN}`,
  'Content-Type': 'application/json',
};

export const sendBalToLegacyCompose = async (
  cog: string,
  forceLegacyCompose: string
) => {
  try {
    const response = await fetch(
      `${BAN_API_URL}/legacy-compose/${cog}?force=${forceLegacyCompose}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${BAN_LEGACY_API_TOKEN}`,
        },
      }
    );

    return await HandleHTTPResponse(response);
  } catch (error) {
    const { message } = error as Error;
    throw new Error(MessageCatalog.ERROR.BAN_LEGACY_API_ERROR.template(message));
  }
};

export const getAddressIdsReport = async (
  districtID: BanDistrictID,
  data: BanIDWithHash[]
) => {
  try {
    const body = JSON.stringify({ districtID, data });
    const response = await fetch(`${BAN_API_URL}/address/delta-report`, {
      method: 'POST',
      headers: defaultHeader,
      body,
    });

    const responseJson = await HandleHTTPResponse(response);
    return responseJson?.response;
  } catch (error) {
    const { message } = error as Error;
    throw new Error(MessageCatalog.ERROR.BAN_API_ERROR.template(message));
  }
};

export const createAddresses = async (addresses: BanAddresses) => {
  try {
    const body = JSON.stringify(addresses);
    const response = await fetch(`${BAN_API_URL}/address`, {
      method: 'POST',
      headers: defaultHeader,
      body,
    });
    return await HandleHTTPResponse(response);
  } catch (error) {
    const { message } = error as Error;
    throw new Error(MessageCatalog.ERROR.BAN_API_ERROR.template(message));
  }
};

export const updateAddresses = async (addresses: BanAddresses) => {
  try {
    const body = JSON.stringify(addresses);
    const response = await fetch(`${BAN_API_URL}/address`, {
      method: 'PUT',
      headers: defaultHeader,
      body,
    });
    return await HandleHTTPResponse(response);
  } catch (error) {
    const { message } = error as Error;
    throw new Error(MessageCatalog.ERROR.BAN_API_ERROR.template(message));
  }
};

export const deleteAddresses = async (ids: BanAddressID[]) => {
  try {
    const body = JSON.stringify(ids);
    const response = await fetch(`${BAN_API_URL}/address/delete`, {
      method: 'POST',
      headers: defaultHeader,
      body,
    });
    return await HandleHTTPResponse(response);
  } catch (error) {
    const { message } = error as Error;
    throw new Error(MessageCatalog.ERROR.BAN_API_ERROR.template(message));
  }
};

export const getCommonToponymIdsReport = async (
  districtID: BanDistrictID,
  data: BanCommonTopoIDWithHash[]
) => {
  try {
    const body = JSON.stringify({ districtID, data });
    const response = await fetch(`${BAN_API_URL}/common-toponym/delta-report`, {
      method: 'POST',
      headers: defaultHeader,
      body,
    });

    const responseJson = await HandleHTTPResponse(response);
    return responseJson?.response;
  } catch (error) {
    const { message } = error as Error;
    throw new Error(MessageCatalog.ERROR.BAN_API_ERROR.template(message));
  }
};

export const createCommonToponyms = async (
  commonToponyms: BanCommonToponyms
) => {
  try {
    const body = JSON.stringify(commonToponyms);
    const response = await fetch(`${BAN_API_URL}/common-toponym`, {
      method: 'POST',
      headers: defaultHeader,
      body,
    });

    return await HandleHTTPResponse(response);
  } catch (error) {
    const { message } = error as Error;
    throw new Error(MessageCatalog.ERROR.BAN_API_ERROR.template(message));
  }
};

export const updateCommonToponyms = async (
  commonToponyms: BanCommonToponyms
) => {
  try {
    const body = JSON.stringify(commonToponyms);
    const response = await fetch(`${BAN_API_URL}/common-toponym`, {
      method: 'PUT',
      headers: defaultHeader,
      body,
    });
    return await HandleHTTPResponse(response);
  } catch (error) {
    const { message } = error as Error;
    throw new Error(MessageCatalog.ERROR.BAN_API_ERROR.template(message));
  }
};

export const deleteCommonToponyms = async (ids: BanCommonTopoID[]) => {
  try {
    const body = JSON.stringify(ids);
    const response = await fetch(`${BAN_API_URL}/common-toponym/delete`, {
      method: 'POST',
      headers: defaultHeader,
      body,
    });
    return await HandleHTTPResponse(response);
  } catch (error) {
    const { message } = error as Error;
    throw new Error(MessageCatalog.ERROR.BAN_API_ERROR.template(message));
  }
};

export const getDistricts = async (ids: BanDistrictID[]) => {
  try {
    const districts = await Promise.all(
      [...new Set(ids)].map(
        (id) => fetch(
          `${BAN_API_URL}/district/${id}`,
          { headers: defaultHeader },
        )
          .then(res => HandleHTTPResponse(res))
          .then(responseJson => responseJson?.response)
          .then(district => ([district.id, district] as const))
      )
    );
    const indexedDistricts = Object.fromEntries(districts);
    const remapedDistricts = ids.map(id => indexedDistricts?.[id]);
    return remapedDistricts;
  } catch (error) {
    const { message } = error as Error;
    throw new Error(MessageCatalog.ERROR.BAN_API_ERROR.template(message));
  }
};

export const getDistrictFromCOG = async (cog: string) => {
  try {
    const response = await fetch(`${BAN_API_URL}/district/cog/${cog}`, {
      headers: defaultHeader,
    });

    const responseJson = await HandleHTTPResponse(response);
    return responseJson?.response;
  } catch (error) {
    const { message } = error as Error;
    throw new Error(MessageCatalog.ERROR.BAN_API_ERROR.template(message));
  }
};

export const partialUpdateDistricts = async (partialDistricts: any) => {
  try {
    const body = JSON.stringify(partialDistricts);
    const response = await fetch(`${BAN_API_URL}/district`, {
      method: 'PATCH',
      headers: defaultHeader,
      body,
    });
    return await HandleHTTPResponse(response);
  } catch (error) {
    const { message } = error as Error;
    throw new Error(MessageCatalog.ERROR.BAN_API_ERROR.template(message));
  }
};

export const getDistrictCountsFromID = async (districtID: string) => {
  try {
    const response = await fetch(`${BAN_API_URL}/district/count/${districtID}`, {
      headers: defaultHeader,
    });
    const responseJson = await HandleHTTPResponse(response);
    return responseJson?.response;
  } catch (error) {
    const { message } = error as Error;
    throw new Error(MessageCatalog.ERROR.BAN_API_ERROR.template(message));
  }
};