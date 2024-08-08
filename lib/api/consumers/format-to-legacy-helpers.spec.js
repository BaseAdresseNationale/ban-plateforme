import {checkIfCleInteropIsValid} from './format-to-legacy-helpers.js'

describe('checkIfCleInteropIsValid', () => {
  test('should return false for an empty string', () => {
    expect(checkIfCleInteropIsValid('')).toBe(false)
  })

  test('should return false for a null value', () => {
    expect(checkIfCleInteropIsValid(null)).toBe(false)
  })

  test('should return false for a string with "xxxx" as the street code', () => {
    expect(checkIfCleInteropIsValid('31555_xxxx_00001')).toBe(false)
  })

  test('should return false for a string not matching the pattern', () => {
    expect(checkIfCleInteropIsValid('315_7172_00001')).toBe(false)
    expect(checkIfCleInteropIsValid('31555_7172a_00001')).toBe(false)
    expect(checkIfCleInteropIsValid('31555_ilwhc0_000001')).toBe(false)
    expect(checkIfCleInteropIsValid('31555_ilwhc0_0000a')).toBe(false)
    expect(checkIfCleInteropIsValid('31555_Ilwhc0_00001')).toBe(false)
    expect(checkIfCleInteropIsValid('31555_Ilwhc0_00001_bât')).toBe(false)
    expect(checkIfCleInteropIsValid('31555_Ilwhc0_00001_bât.a')).toBe(false)
    expect(checkIfCleInteropIsValid('31555_Ilwhc0_00001_bât a')).toBe(false)
  })

  test('should return false for a string with invalid characters', () => {
    expect(checkIfCleInteropIsValid('31555_ilwhc#_00001')).toBe(false)
    expect(checkIfCleInteropIsValid('31555_ilwhc!_00001')).toBe(false)
  })

  test('should return true for a string matching the pattern', () => {
    expect(checkIfCleInteropIsValid('31555_ilwhc0_00001')).toBe(true)
    expect(checkIfCleInteropIsValid('31555_7172_00001')).toBe(true)
    expect(checkIfCleInteropIsValid('31555_7172_00001_bis')).toBe(true)
    expect(checkIfCleInteropIsValid('31555_7172_00001_a1')).toBe(true)
    expect(checkIfCleInteropIsValid('31555_7172_00001_bis_a1')).toBe(true)
  })
})
