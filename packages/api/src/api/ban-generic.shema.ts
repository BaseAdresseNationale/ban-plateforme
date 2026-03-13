import { z } from 'zod';

// export const pgDateString = z.string().refine((dateStr) => !isNaN(Date.parse(dateStr)), { message: 'Invalid date string' }); // ISO 8601 date string in Postgres format
export const pgDateString = z.date().refine((dateStr) => !isNaN(dateStr.getTime()), { message: 'Invalid date string' }); // ISO 8601 date string in Postgres format

// ----------------
// Position types
// ----------------

const balPositionsEnum = [
    'entrée',
    'bâtiment',
    'cage d’escalier',
    'logement',
    'service technique',
    'délivrance postale',
    'parcelle',
    'segment',
    'autre'
] as const;
const balPositionTypes = z.enum(balPositionsEnum);

const banPositionsEnum = [
    'entrance',
    'building',
    'staircase identifier',
    'unit identifier',
    'utility service',
    'postal delivery',
    'parcel',
    'segment',
    'other'
] as const;
const banPositionTypes = z.enum(banPositionsEnum);

const balPositionsToBanPosition = balPositionsEnum.reduce((acc, curr, index) => {
    acc[curr] = banPositionsEnum[index];
    return acc;
}, {} as Record<typeof balPositionsEnum[number], typeof banPositionsEnum[number]>);

const transformBalPositionToBanPosition = (balPos: typeof balPositionsEnum[number]): typeof banPositionsEnum[number] => balPositionsToBanPosition[balPos];

export const typePositionsSchema = balPositionTypes.transform(transformBalPositionToBanPosition) || banPositionTypes;

export const banGeometrySchema = z.object({
    type: z.string(), // e.g. 'Point'
    coordinates: z.array(z.coerce.number()),
});

// -------------------------
// Common types and schemas
// -------------------------

export const banID = z.string().uuid(); // UUID v4

/**
 * BanNumber type: integer >= 0
 * Can be provided as number or string (e.g. "12")
 * Empty string or invalid string will be treated as undefined
 * Other types will raise a validation error
 */
export const banNumber = z.preprocess(
  (val) => {
    switch(typeof val) {
      case 'number':
        return val;
      case 'string': {
        if(val.trim() === '') {
          return undefined;
        }
        const parsed = parseInt(val, 10);
        if(!isNaN(parsed)) {
          return parsed;
        }
        break;
      }
      case 'undefined': {
        return undefined;
      }
      default: {
        return 'Invalid number';
      }
    }
  },
  z.number().int().min(0).optional()
);

export const label = z.object({
  isoCode: z.string(),
  value: z.string(),
});

// -------------
// Meta schemas
// -------------

export const metaCadastreSchema = z.object({
  ids: z.array(z.string()),
});

export const metaBalSchema = z.object({
  idRevision: z.string(),
  dateRevision: z.string(),
  codeAncienneCommune: z.string(),
  nomAncienneCommune: z.string(),
  isLieuDit: z.boolean(),
  cleInterop: z.string(),
  deprecatedID: z.string(),
});

export const metaIdfixSchema = z.object({
  hash: z.string(),
});

// -------------------------
// Exported types & schemas
// -------------------------

export {
  type BanID,
  type Label,
  type BanNumber,
  type PgDateString,
}

declare global {
  // Helper types
  type PgDateString = z.infer<typeof pgDateString>;

  // BAN Generic Types
  type BanID = z.infer<typeof banID>;
  type BanNumber = z.infer<typeof banNumber>;
  type Label = z.infer<typeof label>;

  // BAN Meta Types
  type MetaBanBal = z.infer<typeof metaBalSchema>;
  type MetaBanCadastre = z.infer<typeof metaCadastreSchema>;
  type MetaBanIdFix = z.infer<typeof metaIdfixSchema>;

  // Geometry Types
  type BanGeometry = z.infer<typeof banGeometrySchema>;

  // BanObjects type
  interface BanObjects {
    districts: Record<string, BanDistrict>;
    // commonToponyms: Record<string, BanCommonToponym>;
    commonToponyms: Record<string, any>; // FIXME: to be replaced with actual BanCommonToponym type when available
    // addresses: Record<string, BanAddress>;
    addresses: Record<string, any>; // FIXME: to be replaced with actual BanAddress type when available
  }
}


// -----------------
// Legacy schemas
// -----------------

// import {object, string, number, array, boolean} from 'yup'

// export const banID = string().trim().uuid()
// --- export const banID = z.string().uuid(); // UUID v4

// export const labelSchema = object({
//   isoCode: string().trim().length(3).required(),
//   value: string().trim().required(),
// }).noUnknown()
export const labelSchema = label;

// export const geometrySchema = object({
//   type: string().trim().matches(/^Point$/).required(),
//   coordinates: array().length(2).of(number()).required(),
// }).noUnknown()
export const geometrySchema = banGeometrySchema;

// export const cadastreSchema = object({
//   ids: array().of(string().trim())
// }).noUnknown()
export const cadastreSchema = metaCadastreSchema;

// export const balSchema = object({
//   idRevision: string().trim(),
//   dateRevision: string().trim(),
//   codeAncienneCommune: string().trim(),
//   nomAncienneCommune: string().trim(),
//   isLieuDit: boolean(),
//   cleInterop: string().trim(),
//   deprecatedID: string().trim(),
// }).noUnknown()
export const balSchema = metaBalSchema;

// export const idfixSchema = object({
//   hash: string().trim(),
// }).noUnknown()
export const idfixSchema = metaIdfixSchema;
