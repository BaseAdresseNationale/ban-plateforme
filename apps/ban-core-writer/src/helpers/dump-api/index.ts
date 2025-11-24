import HandleHTTPResponse from '../../utils/http-request-handler.js';
import { MessageCatalog } from '../../utils/status-catalog.js';

const API_DEPOT_URL = process.env.API_DEPOT_URL || '';

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
    throw new Error(MessageCatalog.ERROR.DUMP_API_ERROR.template('Get Revision From District COG', message, url));
  }
};

const getRevisionFileText = async (revisionId: string) => {
  const url = `${API_DEPOT_URL}/revisions/${revisionId}/files/bal/download`;
  try {
    const response = await fetch(url);
    return await HandleHTTPResponse(response);
  } catch (error) {
    const { message } = error as Error;
    throw new Error(MessageCatalog.ERROR.DUMP_API_ERROR.template('Get Revision File Text', message, url));
  }
};

// Export de la fonction pour récupérer seulement l'ID de révision
export const getRevisionId = async (cog: string) => {
  const revision = await getRevisionFromDistrictCOG(cog);
  return revision.id;
};