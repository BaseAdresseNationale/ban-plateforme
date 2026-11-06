import Handlebars from 'handlebars';
import {annotation, t} from './locales.mjs';

// The library's template API exposes unresolvedSchema: preserve compositions and
// reference siblings instead of flattening validation semantics for display.
export const anchor = pointer => `node-${Buffer.from(pointer).toString('base64url') || 'root'}`;
const segment = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
const maps = new Set(['$defs', 'properties', 'patternProperties', 'dependentSchemas']);
const lists = new Set(['oneOf', 'allOf', 'anyOf', 'prefixItems']);
const singles = new Set(['items', 'additionalProperties', 'unevaluatedProperties', 'contains', 'not', 'if', 'then', 'else', 'propertyNames']);
const structure = new Set([...maps, ...lists, ...singles]);

export function children(schema, pointer = '') {
  if (typeof schema !== 'object' || schema === null) return [];
  return Object.entries(schema).flatMap(([key, value]) => {
    if (maps.has(key) || lists.has(key)) {
      return Object.entries(value).map(([name, child]) => ({
        label: `${key} / ${name}`,
        pointer: `${pointer}/${segment(key)}/${segment(name)}`,
        schema: child,
        property: key === 'properties',
        required: schema.required?.includes(name) ?? false,
      }));
    }
    if (singles.has(key) && typeof value === 'object' && value !== null) {
      return [{label: key, pointer: `${pointer}/${segment(key)}`, schema: value}];
    }
    return [];
  });
}

export function facts(schema, language = 'fr') {
  if (typeof schema === 'boolean') return [{key: t(language, 'booleanSchema'), value: String(schema)}];
  return Object.entries(schema).filter(([key, value]) =>
    !['title', 'description', '$ref', '$defs', 'x-i18n'].includes(key)
    && (!structure.has(key) || typeof value === 'boolean'),
  ).map(([key, value]) => ({key, value: JSON.stringify(value)}));
}

export function reference(ref) {
  const [file, fragment = ''] = ref.split('#');
  return `${file.replace(/\.json$/, '.html')}#${anchor(decodeURIComponent(fragment))}`;
}

export function registerTemplateHelpers(language = 'fr') {
  Handlebars.registerHelper('banT', key => t(language, key));
  Handlebars.registerHelper('banText', (schema, key) => annotation(schema, key, language));
  Handlebars.registerHelper('banAnchor', anchor);
  Handlebars.registerHelper('banRef', reference);
  Handlebars.registerHelper('banFacts', schema => facts(schema, language));
  Handlebars.registerHelper('banChildren', children);
  Handlebars.registerHelper('banType', schema => {
    if (typeof schema === 'boolean') return t(language, schema ? 'anyValue' : 'noValue');
    if (schema.type) return [].concat(schema.type).join(' | ');
    if (schema.$ref) return t(language, 'reference');
    if (Object.hasOwn(schema, 'const')) return `const = ${JSON.stringify(schema.const)}`;
    if (schema.enum) return t(language, 'enumeration');
    if (schema.oneOf) return t(language, 'oneOf');
    if (schema.allOf) return t(language, 'allOf');
    if (schema.anyOf) return t(language, 'anyOf');
    return t(language, 'generic');
  });
}
