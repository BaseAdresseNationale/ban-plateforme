import { idsIdentifier } from './bal-converter/bal-converter.config.js';

export type IdsIdentifierKey = (typeof idsIdentifier)[number]['key'];

export type Identifier = {
  key: IdsIdentifierKey;
  prefix: string;
  regExp: RegExp | string;
  batch?: boolean;
};
