import { beautify } from '@etalab/adresses-util/lib/voies'
import { trim, deburr } from 'lodash-es/lodash.js'
// import { normalize } from '@nivalis/normadresse'

function slugify(str: string) {
    return trim(deburr(str).toLowerCase().replace(/\W+/g, '-'), ' -')
}

function beautifyUppercased(str: string) {
    return str === str.toUpperCase()
        ? beautify(str)
        : str
}

function normalizeSuffixe(suffixe: string) {
    if (!suffixe) {
        return undefined
    }
    return suffixe.toLowerCase()
}

export default { slugify, beautifyUppercased, normalizeSuffixe }