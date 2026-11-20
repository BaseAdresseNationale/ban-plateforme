export interface PostalInput {
  inseeCom?: string
  position?: { long: number; lat: number }
}

export interface PostalMatch {
  code: string
  label: string | null
}

export interface PostalSnapshot {
  available: boolean
  matches: PostalMatch[]
}

export interface PostalResult {
  code_postal: string | string[]
  libelle_acheminement: string | null
  libelles_acheminement: Record<string, string>
}

export class PostalError extends Error {
  constructor(readonly status: 400 | 404 | 409 | 503, message: string) {
    super(message)
    this.name = 'PostalError'
  }
}

const invalidInput = () => new PostalError(400, 'Invalid postal lookup parameters')

export function parsePostalInput(query: Record<string, unknown>): PostalInput {
  if (Object.keys(query).some(key => !['inseeCom', 'long', 'lat'].includes(key))) {
    throw invalidInput()
  }
  const { inseeCom, long, lat } = query
  if (inseeCom !== undefined && (
    typeof inseeCom !== 'string' || inseeCom.length !== 5
    || !/^(?:\d{5}|2[AB]\d{3})$/.test(inseeCom)
  )) throw invalidInput()
  if ((long === undefined) !== (lat === undefined)) throw invalidInput()
  if (long === undefined && inseeCom === undefined) throw invalidInput()
  if (long === undefined) return { inseeCom: inseeCom as string }
  const coordinate = (value: unknown, limit: number) => {
    if (typeof value !== 'string' || value.length > 32 || value.trim() !== value || value === '') {
      throw invalidInput()
    }
    if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) throw invalidInput()
    const number = Number(value)
    if (!Number.isFinite(number) || Math.abs(number) > limit) throw invalidInput()
    return number
  }
  return {
    ...(inseeCom === undefined ? {} : { inseeCom: inseeCom as string }),
    position: { long: coordinate(long, 180), lat: coordinate(lat, 90) },
  }
}

export function createPostalLookup(
  read: (input: PostalInput) => Promise<PostalSnapshot>,
) {
  return async (input: PostalInput): Promise<PostalResult> => {
    const snapshot = await read(input)
    if (!snapshot.available) {
      throw new PostalError(503, 'Postal references are unavailable')
    }
    if (snapshot.matches.length === 0) {
      throw new PostalError(404, 'No postal result found')
    }
    const labels = new Map<string, string>()
    for (const match of snapshot.matches) {
      if (!match.label || match.label.trim() === '') {
        throw new PostalError(503, 'Postal references are incomplete')
      }
      if (labels.has(match.code) && labels.get(match.code) !== match.label) {
        throw new PostalError(409, 'Ambiguous postal result')
      }
      labels.set(match.code, match.label)
    }
    const codes = [...labels.keys()].sort()
    if (input.position && codes.length > 1) {
      throw new PostalError(409, 'Ambiguous postal result')
    }
    return {
      code_postal: codes.length === 1 ? codes[0] : codes,
      libelle_acheminement: codes.length === 1 ? labels.get(codes[0])! : null,
      libelles_acheminement: Object.fromEntries(codes.map(code => [code, labels.get(code)!])),
    }
  }
}
