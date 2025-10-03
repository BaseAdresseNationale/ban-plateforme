import HandleHTTPResponse from "../utils/http-request-handler.js";

const BAN_API_URL = process.env.BAN_API_URL || '';

export const getDistrictFromCOG = async (cog: string) => {
  try {
    const response = await fetch(`${BAN_API_URL}/district/cog/${cog}`, {});
    const responseJson = await HandleHTTPResponse(response);
    return responseJson?.response;
  } catch (error) {
    const { message } = error as Error;
    throw new Error(`Bal parser - ${message}`);
  }
};