import { int } from 'zod/v4';
import HandleHTTPResponse from '../helpers/http-request-handler.js';

const API_DEPOT_URL = process.env.API_DEPOT_URL || '';

interface SourceOfRevision {
    nom: string;
    mandataire: string;
}

interface Revision {
  id: string;
  client?: SourceOfRevision
}

const getRevisionFromDistrictCOG = async (cog: string): Promise<false|Revision> => {
  const url = `${API_DEPOT_URL}/communes/${cog}/current-revision`;
  try {
    const response = await fetch(url);
    if (response.status === 404) {
      return false;
    }
    return await HandleHTTPResponse(response) as Revision;
  } catch (error) {
    const { message } = error as Error;
    throw new Error(`Dump API - Get Revision From District COG - ${message} ${url}`);
  }
};

const getRevisionFileText = async (revisionId: string): Promise<string> => {
  const url = `${API_DEPOT_URL}/revisions/${revisionId}/files/bal/download`;
  try {
    console.log('revisionId', revisionId)
    const response = await fetch(url);
    return await HandleHTTPResponse(response) as string;
  } catch (error) {
    const { message } = error as Error;
    throw new Error(`Dump API - Get Revision File Text - ${error} ${message} (${url})`);
  }
};

interface RevisionData {
  revision: Revision;
  balTextData: string;
}

export const getRevisionData = async (cog: string): Promise<false|RevisionData> => {
  const revision = await getRevisionFromDistrictCOG(cog);
  if (revision === false) return false;
  const balTextData = await getRevisionFileText(revision.id);
  return { revision, balTextData };
};
