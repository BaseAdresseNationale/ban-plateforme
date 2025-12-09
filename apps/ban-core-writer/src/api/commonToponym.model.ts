import { z } from 'zod';
import { getUUIDv4 } from "../tools/uuid-v4.js";

import {
  label,
  pgDateString,
  banGeometrySchema,
  metaCadastreSchema,
  metaBalSchema,
  metaIdfixSchema,
} from './ban-generic.model.js';
import { banDistrictSchema } from './district.model.js';

const metaCommonToponymSchema = z.object({
    cadastre: metaCadastreSchema.optional(),
    bal: metaBalSchema.optional(),
    idfix: metaIdfixSchema.optional(),
});

export const genericCommonToponymSchema = z.object({
    id: z.string().uuid().default(getUUIDv4),
    districtID: z.string().uuid().default(''),
    labels: z.array(label).default([]),
    geometry: banGeometrySchema.default({ type: 'Point', coordinates: [0, 0] }),
    meta: metaCommonToponymSchema.optional().default({}),
});

export const banCommonToponymSchema = genericCommonToponymSchema.extend({
    district: banDistrictSchema,
    legalityDate: pgDateString,
});

export const banPgCommonToponymSchema = genericCommonToponymSchema.extend({
    updateDate: pgDateString.default(() => new Date().toISOString()),
});

// extract the inferred type
declare global {
  type BanCommonToponymMeta = z.infer<typeof metaCommonToponymSchema>;
  type GenericCommonToponym = z.infer<typeof genericCommonToponymSchema>;
  type BanCommonToponym = z.infer<typeof banCommonToponymSchema>;
  type BanPgCommonToponym = z.infer<typeof banPgCommonToponymSchema>;
}

