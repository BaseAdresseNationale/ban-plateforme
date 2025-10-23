import { beautify } from '@etalab/adresses-util/lib/voies'

export const DEFAULT_ISO_CODE = 'fra'; // Default ISO code for labels

export function beautifyUppercased(str: string, lang: string = DEFAULT_ISO_CODE): string {
    if (str !== str.toUpperCase()) {
        return str
    }
    switch (lang) {
        case DEFAULT_ISO_CODE:
            return beautify(str)
        default:
            return str
    }
}

export function normalizeSuffixe(suffixe: string) {
    if (!suffixe) {
        return undefined
    }
    return suffixe.toLowerCase()
}