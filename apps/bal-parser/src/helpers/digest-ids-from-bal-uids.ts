import { idsIdentifier } from './bal-converter.config.js';

import type { Identifier } from './bal-converter.config.js';

const digestIDsFromBalUIDs = (ids?: string) => {
  const regExpIds = new RegExp(
    idsIdentifier.reduce(
      (acc, { key, prefix, regExp, batch = false }: Identifier) => {
        const strRegExp = typeof regExp === 'string' ? regExp : regExp.source;
        const keyRegExp = batch ? `(\\|?${strRegExp})*` : strRegExp;
        return `${acc ? `${acc}|` : ''}(${prefix}(?<${key}>${`${keyRegExp}`}))`;
      },
      ''
    ),
    'igm'
  );

  return Object.fromEntries(
    ids
      ? [...ids.matchAll(regExpIds)].flatMap(({ groups }) =>
          Object.entries(groups as { [key: string]: string | undefined })
            .filter(([, value]) => value)
            .map(([key, value]) => {
              switch (key) {
                case 'secondaryTopoIDs':
                  return [key, (value as string).split('|')];
                default:
                  return [key, value];
              }
            })
        )
      : []
  );
};

export default digestIDsFromBalUIDs;
