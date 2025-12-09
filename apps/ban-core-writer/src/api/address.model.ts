import { z } from 'zod';

import { getUUIDv4 } from "../tools/uuid-v4.js";
import {
  label,
  banID,
  banNumber,
  pgDateString,
  metaCadastreSchema,
  metaBalSchema,
  metaIdfixSchema,
  typePositionsSchema,
  banGeometrySchema,
} from './ban-generic.model.js';
import { banCommonToponymSchema } from './commonToponym.model.js';
import { banDistrictSchema } from './district.model.js';

// ----------------
// Address schemas
// ----------------

const positionSchema = z.object({
    type: typePositionsSchema,
    geometry: banGeometrySchema,
});

const metaSchema = z.object({
  cadastre: metaCadastreSchema.optional(),
  bal: metaBalSchema.optional(),
  idfix: metaIdfixSchema.optional(),
});

const genericAddressSchema = z.object({
    id: banID.default(getUUIDv4),
    mainCommonToponymID: banID,
    secondaryCommonToponymIDs: z.array(banID),
    districtID: banID,
    labels: z.array(label),
    number: banNumber,
    suffix: z.string().optional(),
    certified: z.boolean(),
    positions: z.array(positionSchema),
    meta: metaSchema,
});

const banAddressSchema = genericAddressSchema.extend({
    mainCommonToponym: banCommonToponymSchema,
    secondaryCommonToponyms: z.array(banCommonToponymSchema).optional(), // Optional, may be populated
    district: banDistrictSchema,
    legalityDate: pgDateString,
});

export const banPgAddressSchema = genericAddressSchema.extend({
    updateDate: pgDateString.default(() => new Date().toISOString()),
});

// -----------------
// Exported types
// -----------------

// extract the inferred type and declare as global
declare global {
  // Address Types
  type GenericAddress = z.infer<typeof genericAddressSchema>

  // BAN Addresss Positions Types
  type BanAddressPosition = z.infer<typeof positionSchema>

  // BAN Address Types
  type BanAddress = z.infer<typeof banAddressSchema>
  type BanPgAddress = z.infer<typeof banPgAddressSchema>
}
