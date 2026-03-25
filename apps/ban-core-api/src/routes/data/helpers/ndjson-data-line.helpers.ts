const getObjectForFilter = (data: Record<string, unknown>, excludeKeys: string[] = []) => {
  return Object.entries(data).reduce((acc, [key, value]) => {
    if (!excludeKeys.includes(key)) {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, unknown>);
}

export const isUnlike = (
    before?: Record<string, unknown> | null,
    after?: Record<string, unknown> | null,
    excludeKeys?: string[],
): boolean => {
  if ((before && !after) || (!before && after)) return true; // Keep all 'created' and 'disabled' events
  if (!before && !after) return false; // Exclude events where both before and after are null/undefined (shouldn't happen but just in case)
  const dataBeforeForFilter = getObjectForFilter(before || {}, excludeKeys);
  const dataAfterForFilter = getObjectForFilter(after || {}, excludeKeys);
  const beforeAsString = JSON.stringify(dataBeforeForFilter);
  const afterAsString = JSON.stringify(dataAfterForFilter);
  return (beforeAsString !== afterAsString);
};
