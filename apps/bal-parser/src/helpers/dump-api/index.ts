// import { fetchFakeData } from '../../utils/fake-api-call.js';
import HandleHTTPResponse from '../../utils/http-request-handler.js';

const API_DEPOT_URL = process.env.API_DEPOT_URL || '';

export const getRevisionData = async (cog: string) => {
  const revision = await getRevisionFromDistrictCOG(cog);
  const balTextData = await getRevisionFileText(revision.id);
  return { revision, balTextData };
};

const getRevisionFromDistrictCOG = async (cog: string) => {
  const url = `${API_DEPOT_URL}/communes/${cog}/current-revision`;
  
  /* 
    const fakeData = {
      "id": "6867ea648e1f6be19b4c733f",
      "createdAt": "2025-07-04T14:51:16.467Z",
      "updatedAt": "2025-07-04T14:52:13.406Z",
      "clientId": "6618195040d481d08b0c4162",
      "codeCommune": "75101",
      "isReady": null,
      "isCurrent": true,
      "status": "published",
      "context": {
        "extras": {
          "internal_id": "202507"
        },
        "nomComplet": "BDATAT Fabric",
        "organisation": "Ville de Paris"
      },
      "validation": {
        "infos": [
          "field.uid_adresse.missing",
          "field.lieudit_complement_nom.missing",
          "field.commune_deleguee_insee.missing",
          "field.commune_deleguee_nom.missing"
        ],
        "valid": true,
        "errors": [],
        "warnings": [],
        "rowsCount": 3221,
        "validatorVersion": "3.1.11"
      },
      "habilitation": null,
      "publishedAt": "2025-07-04T14:52:13.406Z",
      "client": {
        "id": "6618195040d481d08b0c4162",
        "legacyId": null,
        "nom": "Ville de Paris",
        "mandataire": "Ville de Paris",
        "chefDeFile": "Ville de Paris",
        "chefDeFileEmail": "DSTISTINBDATATPoleDataFab@paris.fr"
      },
      "files": [
        {
          "id": "6867ea738e1f6be19b4c7345",
          "revisionId": "6867ea648e1f6be19b4c733f",
          "size": 460376,
          "hash": "771c0c8aca4563cc230156b2a6b2994599060d3cdc4e7c166fefc9300b0bfe0a",
          "type": "bal",
          "createdAt": "2025-07-04T14:51:31.494Z"
        }
      ]
    } 
  */

  try {
    const response = await fetch(url);
    // const response = await fetchFakeData(fakeData) as unknown as Response;

    return await HandleHTTPResponse(response);
  } catch (error) {
    throw error;
    // const { message } = error as Error;
    // throw new Error(`Dump API - Get Revision From District COG - ${message} ${url}`);
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
