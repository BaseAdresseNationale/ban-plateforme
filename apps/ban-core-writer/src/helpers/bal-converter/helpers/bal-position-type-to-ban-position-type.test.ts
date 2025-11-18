import { describe, expect, test } from 'vitest';
import { convertBalPositionTypeToBanPositionType } from './index.js';

describe('balPositionTypeToBanPositionType', () => {
  test('should return undefined', async () => {
    expect(convertBalPositionTypeToBanPositionType('')).toMatchSnapshot();
  });

  test('should return undefined', async () => {
    expect(
      convertBalPositionTypeToBanPositionType('not-in-dictionary')
    ).toMatchSnapshot();
  });

  test('should return entrance', async () => {
    expect(convertBalPositionTypeToBanPositionType('entrée')).toMatchSnapshot();
  });

  test('should return building', async () => {
    expect(
      convertBalPositionTypeToBanPositionType('bâtiment')
    ).toMatchSnapshot();
  });

  test('should return staircase identifier', async () => {
    expect(
      convertBalPositionTypeToBanPositionType('cage d’escalier')
    ).toMatchSnapshot();
  });

  test('should return utility service', async () => {
    expect(
      convertBalPositionTypeToBanPositionType('service technique')
    ).toMatchSnapshot();
  });

  test('should return postal delivery', async () => {
    expect(
      convertBalPositionTypeToBanPositionType('délivrance postale')
    ).toMatchSnapshot();
  });

  test('should return parcel', async () => {
    expect(
      convertBalPositionTypeToBanPositionType('parcelle')
    ).toMatchSnapshot();
  });

  test('should return segment', async () => {
    expect(
      convertBalPositionTypeToBanPositionType('segment')
    ).toMatchSnapshot();
  });

  test('should return other', async () => {
    expect(convertBalPositionTypeToBanPositionType('autre')).toMatchSnapshot();
  });
});
