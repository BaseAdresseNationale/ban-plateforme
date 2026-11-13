import { normalizeExportDate } from '@ban/tools';

export const dateStringToPgTimestamptz = (dateString: string | undefined, withError: boolean = false): 'Invalid date' | string | null => {
  if (typeof dateString !== 'string' || dateString.trim() === '') {
    if (withError) throw new Error("Date string is required");
    return null;
  }
  try {
    return normalizeExportDate(dateString);
  } catch {
    if (withError) throw new Error("Invalid date");
    return 'Invalid date';
  }
}

export const getQueryParams = (
  params: string[],
  allParams: Record<string, any>,
) => params.map(param => allParams?.[param] ?? null)
