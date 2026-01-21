import {
  districtConfigSchema,
  districtInseeMetaSchema,
  districtMetaSchema,
  banDistrictSchema,
  banPgDistrictSchema,
} from './api/district/schema.ts';
import { z } from 'zod';

export {}

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
