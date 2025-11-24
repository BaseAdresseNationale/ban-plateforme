const DATA_TYPE = ['addresses', 'commonToponyms'];
const ACTION_TYPE = ['add', 'update', 'delete'];

export const formatToChunks = (array: any[], size: number) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

export const formatResponse = (allReponses: any[]) => {
  const formatedResponse = {} as any;
  allReponses.forEach((responseType: any[], indexDataType: number) => {
    if (responseType.length > 0) {
      responseType.forEach((responseAction: any[], indexActionType: number) => {
        if (responseAction.length > 0) {
          formatedResponse[DATA_TYPE[indexDataType]] = {
            ...formatedResponse[DATA_TYPE[indexDataType]],
            [ACTION_TYPE[indexActionType]]: responseAction,
          };
        }
      });
    }
  });
  return formatedResponse;
};
