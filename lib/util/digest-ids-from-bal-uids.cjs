const regExpUUIDv4 = /[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}/i

const idsIdentifier = [
  {
    key: 'addressID',
    prefix: '@a:',
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
    key: 'districtID',
    prefix: '@c:',
    regExp: regExpUUIDv4,
  }
]

const digestIDsFromBalUIDs = ids => {
  const regExpIds = new RegExp(
    idsIdentifier.reduce(
      (acc, {key, prefix, regExp, batch = false}) => {
        const strRegExp = typeof regExp === 'string' ? regExp : regExp.source
        const keyRegExp = batch ? `(\\|?${strRegExp})*` : strRegExp
        return `${acc ? `${acc}|` : ''}(${prefix}(?<${key}>${`${keyRegExp}`}))`
      },
      ''
    ),
    'igm'
  )

  return Object.fromEntries(
    ids
      ? [...ids.matchAll(regExpIds)].flatMap(({groups}) =>
        Object.entries(groups)
          .filter(([, value]) => value)
          .map(([key, value]) => {
            switch (key) {
              case 'secondaryTopoIDs':
                return [key, (value).split('|')]
              default:
                return [key, value]
            }
          })
      )
      : []
  )
}

module.exports = {idsIdentifier, digestIDsFromBalUIDs}
