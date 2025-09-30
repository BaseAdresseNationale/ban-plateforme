export const getDistrictFromCOG = async (cog: string) => {
  try {
    await new Promise(resolve => setTimeout(resolve, 3000));
    const responseJson = {
      "date": "2025-09-25T13:04:16.105Z",
      "status": "success",
      "message": "Districts successfully retrieved",
      "response": [
        {
          "id": "a82be4b6-6f76-4974-95a1-6852eb41d04b",
          "labels": [
            {
              "value": "Paris 1er Arrondissement",
              "isoCode": "fra"
            }
          ],
          "updateDate": "2023-01-01T00:00:00.000Z",
          "config": null,
          "meta": {
            "insee": {
              "cog": "75101",
              "isMain": true,
              "mainId": "a82be4b6-6f76-4974-95a1-6852eb41d04b",
              "mainCog": "75101"
            }
          },
          "isActive": true,
          "lastRecordDate": "2025-05-22T09:41:39.847Z"
        }
      ]
    }
    
    // const response = await fetch(`${BAN_API_URL}/district/cog/${cog}`, {
    //   headers: defaultHeader,
    // });

    // const responseJson = await HandleHTTPResponse(response);
    return responseJson?.response;
  } catch (error) {
    const { message } = error as Error;
    throw new Error(`Bal parser - ${message}`);
  }
};