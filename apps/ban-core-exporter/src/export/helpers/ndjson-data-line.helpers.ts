// Dotted paths affect comparison only; the states serialized in the event stay intact.
const getObjectForFilter = (data: Record<string, unknown>, excludeKeys: string[] = []): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (excludeKeys.includes(key)) continue;
    const nestedPaths = excludeKeys.filter(path => path.startsWith(`${key}.`))
      .map(path => path.slice(key.length + 1));
    if (nestedPaths.length && value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = getObjectForFilter(value as Record<string, unknown>, nestedPaths);
      // An optional interop container with only an ignored key is equivalent to absence.
      if (Object.keys(nested).length) result[key] = nested;
    } else result[key] = value;
  }
  return result;
};

export const isUnlike = (
  before?: Record<string, unknown> | null,
  after?: Record<string, unknown> | null,
  excludeKeys?: string[]
): boolean => {
  if ((before && !after) || (!before && after)) {
    return true;
  }

  if (!before && !after) {
    return false;
  }

  const beforeAsString = JSON.stringify(getObjectForFilter(before || {}, excludeKeys));
  const afterAsString = JSON.stringify(getObjectForFilter(after || {}, excludeKeys));

  return beforeAsString !== afterAsString;
};
