import { describe, expect, it } from 'vitest';
import { parseTileCoordinates } from './coordinates.js';

describe('parseTileCoordinates', () => {
  it('accepts valid tiles at the supported zoom boundaries', () => {
    expect(parseTileCoordinates('10', '0', '1023')).toEqual({ z: 10, x: 0, y: 1023 });
    expect(parseTileCoordinates('14', '16383', '0')).toEqual({ z: 14, x: 16383, y: 0 });
  });

  it('rejects invalid zooms and coordinates', () => {
    for (const values of [
      ['9', '0', '0'], ['15', '0', '0'], ['10', '1024', '0'],
      ['10', '0', '1024'], ['10', '-1', '0'], ['10', '1abc', '0'],
    ]) {
      expect(parseTileCoordinates(values[0], values[1], values[2])).toBeNull();
    }
  });
});