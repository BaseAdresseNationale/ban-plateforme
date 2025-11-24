import { BanAddressID, BanCommonTopoID } from './ban-generic-types.js';

export type BanIDWithHash = {
  id: BanAddressID;
  hash: string;
};

export type BanCommonTopoIDWithHash = {
  id: BanCommonTopoID;
  hash: string;
};
