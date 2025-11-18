const regExpUUIDv4 =
  /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

export const idsIdentifier = [
  {
    key: 'districtID',
    prefix: '@c:',
    regExp: regExpUUIDv4,
  },
  {
    key: 'mainTopoID',
    prefix: '@v:',
    regExp: regExpUUIDv4,
  },
  {
    key: 'secondaryTopoIDs',
    prefix: '@t:',
    regExp: `${regExpUUIDv4.source}`,
    batch: true,
  },
  {
    key: 'addressID',
    prefix: '@a:',
    regExp: regExpUUIDv4,
  },
] as const;

export type IdsIdentifierKey = (typeof idsIdentifier)[number]['key'];

export type Identifier = {
  key: IdsIdentifierKey;
  prefix: string;
  regExp: RegExp | string;
  batch?: boolean;
};
