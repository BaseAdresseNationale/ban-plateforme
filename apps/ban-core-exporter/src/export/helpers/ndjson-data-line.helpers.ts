const getObjectForFilter = (data: Record<string, unknown>, excludeKeys: string[] = []) => {
  return Object.entries(data).reduce((acc, [key, value]) => {
    if (!excludeKeys.includes(key)) {
      acc[key] = value;
    }

    return acc;
  }, {} as Record<string, unknown>);
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
