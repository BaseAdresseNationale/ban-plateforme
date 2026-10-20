/** Shared, side-effect-free validation for HTTP enqueueing and internal exports. */
export const EXPORT_FILTER_LIMITS = Object.freeze({ perUuidList: 1000, totalUuids: 2000, departments: 200 });
const uuidKeys = ['address_ids', 'common_toponym_ids', 'district_ids'] as const;
const dataTypes = ['district', 'toponym', 'address'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ExportSelection = {
  dataTypes: string[]; departements: string[];
  address_ids: string[] | null; common_toponym_ids: string[] | null; district_ids: string[] | null;
  at?: string; from?: string; to?: string;
};

export const normalizeExportDate = (value: unknown): string => {
  if (typeof value !== 'string' || value.length > 40) throw new Error('Expected an ISO 8601 date or date-time');
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}(?::?\d{2})?))?$/);
  if (!match) throw new Error('Expected a date-time with timezone and at most six fractional digits');
  const [, year, month, day, hour = '00', minute = '00', second = '00', fraction, zone = 'Z'] = match;
  const calendar = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== `${year}-${month}-${day}`
      || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) throw new Error('Invalid calendar date or time');
  const offset = zone === 'Z' ? zone : zone.length === 3 ? `${zone}:00` : zone.length === 5 ? `${zone.slice(0, 3)}:${zone.slice(3)}` : zone;
  const instant = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`);
  if (!Number.isFinite(instant.getTime())) throw new Error('Invalid timezone');
  return instant.toISOString().replace('.000Z', `.${fraction ?? '000'}Z`);
};

const micros = (value: string) => BigInt(Date.parse(value.replace(/\.\d+Z$/, 'Z'))) * 1000n
  + BigInt((value.match(/\.(\d+)Z$/)?.[1] ?? '').padEnd(6, '0'));

export const normalizeExportSelection = (exportType: 'full' | 'diff', input: unknown): ExportSelection => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Export parameters must be an object');
  const raw = input as Record<string, unknown>;
  const allowed = ['dataTypes', 'departements', ...uuidKeys, 'at', 'from', 'to'];
  if (Object.keys(raw).some(key => !allowed.includes(key))) throw new Error('Unknown export parameter');
  if (!Array.isArray(raw.dataTypes) || raw.dataTypes.length > 3 || raw.dataTypes.some(t => !dataTypes.includes(t))) throw new Error('Invalid dataTypes');
  if (!Array.isArray(raw.departements) || raw.departements.length > EXPORT_FILTER_LIMITS.departments
      || raw.departements.some(d => typeof d !== 'string' || !/^(?:\d{2,3}|2[AB])$/.test(d))) throw new Error('Invalid departements (maximum 200 entries)');
  const count = uuidKeys.reduce((sum, key) => {
    const list = raw[key];
    if (list == null) return sum;
    if (!Array.isArray(list) || list.length === 0) throw new Error(`${key} must be null or a non-empty UUID array`);
    if (list.length > EXPORT_FILTER_LIMITS.perUuidList) throw new Error(`${key} exceeds 1000 entries`);
    return sum + list.length;
  }, 0);
  if (count > EXPORT_FILTER_LIMITS.totalUuids) throw new Error('UUID filters exceed 2000 combined entries');
  const filters = Object.fromEntries(uuidKeys.map(key => {
    const list = raw[key] as unknown[] | null | undefined;
    if (list == null) return [key, null];
    if (list.some(v => typeof v !== 'string' || !uuid.test(v))) throw new Error(`${key} contains an invalid UUID`);
    return [key, [...new Set((list as string[]).map(v => v.toLowerCase()))]];
  })) as Pick<ExportSelection, typeof uuidKeys[number]>;
  const selection: ExportSelection = {
    dataTypes: [...new Set(raw.dataTypes.length ? raw.dataTypes : dataTypes)],
    departements: [...new Set(raw.departements)], ...filters };
  if (exportType === 'full') {
    if (raw.from != null || raw.to != null) throw new Error('Snapshot does not accept from/to');
    selection.at = normalizeExportDate(raw.at ?? new Date().toISOString());
  } else {
    if (raw.at != null) throw new Error('Diff does not accept at');
    selection.from = normalizeExportDate(raw.from);
    selection.to = normalizeExportDate(raw.to ?? new Date().toISOString());
    if (micros(selection.from) >= micros(selection.to)) throw new Error('Diff requires from < to');
  }
  return selection;
};
