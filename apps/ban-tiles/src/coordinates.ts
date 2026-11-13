export interface TileCoordinates {
  z: number;
  x: number;
  y: number;
}

export function parseTileCoordinates(zValue: string, xValue: string, yValue: string): TileCoordinates | null {
  if (![zValue, xValue, yValue].every(value => /^\d+$/.test(value))) return null;

  const z = Number(zValue);
  const x = Number(xValue);
  const y = Number(yValue);
  if (z < 10 || z > 14 || x >= 2 ** z || y >= 2 ** z) return null;

  return { z, x, y };
}