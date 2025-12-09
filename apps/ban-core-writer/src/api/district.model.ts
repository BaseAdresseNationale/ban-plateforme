import { z } from 'zod';

import { getUUIDv4 } from "../tools/uuid-v4.js";
import { label, banID, pgDateString } from './ban-generic.model.js';

const districtConfigSchema = z.object({
    certificate: z.record(z.any()).optional(),
    defaultBalLang: z.string().optional(), // TODO: Enum of supported languages?
});

const districtInseeMetaSchema = z.object({
    cog: z.string(),
    mainCog: z.string(),
    isMain: z.boolean(),
    mainId: banID,
});

const districtMetaSchema = z.object({
    insee: districtInseeMetaSchema.optional(),
    bal: z.record(z.any()).optional(),
});

export const banDistrictSchema = z.object({
    id: banID.default(getUUIDv4),
    labels: z.array(label).default([]),
    config: districtConfigSchema.optional().default({}),
    meta: districtMetaSchema.optional().default({}),
    isActive: z.boolean().optional().default(true),
});

export const banPgDistrictSchema = banDistrictSchema.extend({
    updateDate: pgDateString.default(() => new Date().toISOString()),
});

export {
  DistrictCertificate,
  DistrictConfig,
  DistrictInseeMeta,
  DistrictMeta,
  GenericDistrict,
  BanDistrict,
  BanPgDistrict,
};

// extract the inferred type and declare as global
declare global {
  type DistrictCertificate = z.infer<typeof districtConfigSchema>['certificate'];
  type DistrictConfig = z.infer<typeof districtConfigSchema>;
  type DistrictInseeMeta = z.infer<typeof districtInseeMetaSchema>;
  type DistrictMeta = z.infer<typeof districtMetaSchema>;
  type GenericDistrict = z.infer<typeof banDistrictSchema>;
  type BanDistrict = GenericDistrict;
  type BanPgDistrict = z.infer<typeof banPgDistrictSchema>;
}
