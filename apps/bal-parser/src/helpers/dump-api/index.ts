// import { fetchFakeData } from '../../utils/fake-api-call.js';
import HandleHTTPResponse from '../../utils/http-request-handler.js';

const API_DEPOT_URL = process.env.API_DEPOT_URL || '';
const API_BAL_ASSEMBLY_URL = process.env.API_BAL_ASSEMBLY_URL || '';

export const getRevisionData = async (cog: string) => {
  const revision = await getRevisionFromDistrictCOG(cog);
  const balTextData = await getRevisionFileText(revision.id);
  return { revision, balTextData };
};

const getRevisionFromDistrictCOG = async (cog: string) => {
  const url = `${API_DEPOT_URL}/communes/${cog}/current-revision`;
  try {
    const response = await fetch(url);
    return await HandleHTTPResponse(response);
  } catch (error) {
    const { message } = error as Error;
    throw new Error(`Dump API - Get Revision From District COG - ${message} ${url}`);
  }
};

const getRevisionFileText = async (revisionId: string) => {
  const url = `${API_DEPOT_URL}/revisions/${revisionId}/files/bal/download`;
  try {
    console.log('revisionId', revisionId)
    const response = await fetch(url);
    return await HandleHTTPResponse(response);
  } catch (error) {
    const { message } = error as Error;
    throw new Error(`Dump API - Get Revision File Text - ${error} ${message} (${url})`);
  }
};

export const getBalAssembly = async (codeInsee: any) => {
  const url = `${API_BAL_ASSEMBLY_URL}/bal/codeInsee/${codeInsee}/`;
  try {
    const response = await fetch(url);
    return await HandleHTTPResponse(response);
  } catch (error) {
    const { message } = error as Error;
    throw new Error(`BAL ASSEMBLY API - Get BAL Assembly - ${message} ${url}`);
  }
};
