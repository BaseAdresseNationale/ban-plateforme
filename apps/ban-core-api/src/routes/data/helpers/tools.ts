export const dateStringToPgTimestamptz = (dateString: string | undefined, withError: boolean = false): 'Invalid date' | string | null => {
  if (typeof dateString !== 'string' || dateString.trim() === '') {
    if (withError) throw new Error("Date string is required");
    return null;
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    if (withError) throw new Error("Invalid date");
    return 'Invalid date';
  }
  return date.toISOString();
}

export const getQueryParams = (
  params: string[],
  allParams: Record<string, any>,
) => params.map(param => allParams?.[param] ?? null)
