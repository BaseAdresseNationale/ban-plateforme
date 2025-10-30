import type { BanDistrict } from '@ban/types';

import HandleHTTPResponse from "../helpers/http-request-handler.js";

const BAN_API_URL = process.env.BAN_API_URL || '';

// TODO : Interoger directement la BDD plutot que l'API ou utiliser une package dédié.
export async function getDistrictIDs(cog: string, shouldThrowError: boolean = true): Promise<string[] | null | undefined> {
  try {
    const response = await fetch(`${BAN_API_URL}/district/cog/${cog}`, {});
    const responseJson = await HandleHTTPResponse(response) as {response: BanDistrict[]};
    const districts: BanDistrict[] = responseJson?.response;

    if (!districts?.length) {
      throw new Error(`No district found with cog ${cog}`);
    }

    const districtIDs = districts.map((district) => district.id);
    return districtIDs;
  } catch (error) {
    if (shouldThrowError) {
      const { message } = error as Error;
      throw new Error(`Error on getting district - ${message}`);
    } else {
      return null;
    }
  }
}
