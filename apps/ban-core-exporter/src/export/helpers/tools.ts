export const getQueryParams = (
  params: string[],
  allParams: Record<string, any>
) => params.map(param => allParams?.[param] ?? null);
