import HandleHTTPResponse from '../helpers/http-request-handler.js';

const API_BAL_ASSEMBLY_URL = process.env.API_BAL_ASSEMBLY_URL || '';

type CodeInsee = string;

export const getAssembledBal = async (codeInsee: CodeInsee) => {
  const url = `${API_BAL_ASSEMBLY_URL}/download/${codeInsee}/`;

  try {
    const response = await fetch(url);
    return await HandleHTTPResponse(response) as string;
  } catch (error) {
    const { message } = error as Error;
    throw new Error(`BAL ASSEMBLY API - Get BAL Assembly - ${message} ${url}`);
  }
};
