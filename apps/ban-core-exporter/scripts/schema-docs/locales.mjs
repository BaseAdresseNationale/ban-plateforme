export const languages = ['fr', 'en'];
export const messages = {
  fr: {
    home: 'Comprendre les exports', full: 'Contrat FULL', diff: 'Contrat DIFF', definitions: 'Définitions partagées', examples: 'Exemples NDJSON', specification: 'Spécification normative', correspondences: 'Correspondances CNIG', evaluation: 'Évaluer le POC',
    documentation: 'Documentation BAN', skip: 'Aller au contenu', brand: 'Base Adresse Nationale', tagline: 'Documentation des exports FULL et DIFF', badge: 'Contrat 0.4 · POC', nav: 'Documentation', navTitle: 'Les exports BAN', sourceNote: 'Référence générée depuis les schémas versionnés.', technical: 'Documentation technique',
    nativeNotice: 'Rendu natif en anglais de json-schema-static-docs, sans le modèle BAN. Certaines informations et ancres sont incomplètes : voir l’évaluation.',
    expand: 'Tout déplier', collapse: 'Tout replier', source: 'Schéma JSON source', markdown: 'Version Markdown',
    help: 'Les références ouvrent la définition ciblée. Les contraintes des blocs allOf se cumulent ; l’obligation d’un champ est indiquée dans le bloc qui la déclare.',
    back: 'Retour en haut', footer: 'Documentation du contrat v0.4', credits: 'Génération Node.js · json-schema-static-docs · Styles DSFR locaux', language: 'Choisir la langue',
    reference: 'Référence', constraints: 'Contraintes déclarées dans ce bloc', keyword: 'Mot-clé JSON Schema', value: 'Valeur', required: 'Obligatoire dans cet objet', optional: 'Non exigé par ce bloc',
    booleanSchema: 'Schéma booléen', anyValue: 'Toute valeur', noValue: 'Aucune valeur', enumeration: 'Énumération', oneOf: 'Une seule alternative', allOf: 'Toutes les contraintes', anyOf: 'Au moins une alternative', generic: 'Contraintes',
    examplesIntro: 'Ces données fictives proviennent des fixtures versionnées du contrat v0.4. Les retours à la ligne à l’écran ne modifient pas les lignes du fichier.', download: 'Télécharger le fichier',
  },
  en: {
    home: 'Understanding exports', full: 'FULL contract', diff: 'DIFF contract', definitions: 'Shared definitions', examples: 'NDJSON examples', specification: 'Contract specification', correspondences: 'CNIG mappings', evaluation: 'Evaluate the POC',
    documentation: 'BAN documentation', skip: 'Skip to content', brand: 'Base Adresse Nationale', tagline: 'FULL and DIFF export documentation', badge: 'Contract 0.4 · POC', nav: 'Documentation', navTitle: 'BAN exports', sourceNote: 'Reference generated from the versioned schemas.', technical: 'Technical documentation',
    nativeNotice: 'Original English output from json-schema-static-docs, without the BAN template. Some information and anchors are incomplete: see the evaluation.',
    expand: 'Expand all', collapse: 'Collapse all', source: 'Source JSON Schema', markdown: 'Markdown version',
    help: 'References open the target definition. Constraints in allOf blocks apply together; a field’s required status is shown in the block that declares it.',
    back: 'Back to top', footer: 'Contract v0.4 documentation', credits: 'Generated with Node.js · json-schema-static-docs · Local DSFR styles', language: 'Choose a language',
    reference: 'Reference', constraints: 'Constraints declared in this block', keyword: 'JSON Schema keyword', value: 'Value', required: 'Required in this object', optional: 'Not required by this block',
    booleanSchema: 'Boolean schema', anyValue: 'Any value', noValue: 'No value', enumeration: 'Enumeration', oneOf: 'Exactly one alternative', allOf: 'All constraints', anyOf: 'At least one alternative', generic: 'Constraints',
    examplesIntro: 'These fictional data come from the versioned v0.4 contract fixtures. Visual line wrapping does not change the lines in the file.', download: 'Download the file',
  },
};

export function t(language, key) {
  const message = messages[language]?.[key];
  if (typeof message !== 'string' || !message.trim()) throw new Error(`Missing interface translation: ${language}.${key}`);
  return message;
}

export function annotation(schema, key, language) {
  const value = language === 'en' ? schema[key] : schema['x-i18n']?.[language]?.[key];
  if (schema[key] !== undefined && (typeof value !== 'string' || !value.trim())) {
    throw new Error(`Missing ${language} translation for ${key}: ${schema.$id ?? schema[key]}`);
  }
  return value;
}

// Walk schema positions only, never annotations, enum values or instance examples.
export function validateAnnotations(schema, location = '#') {
  if (typeof schema !== 'object' || schema === null) return 0;
  let count = 0;
  for (const key of ['title', 'description']) if (Object.hasOwn(schema, key)) {
    for (const language of languages) annotation(schema, key, language);
    count++;
  }
  const translated = schema['x-i18n'];
  if (translated) {
    if (Object.keys(translated).some(language => language !== 'fr')) throw new Error(`Unexpected translation language at ${location}`);
    for (const key of Object.keys(translated.fr ?? {})) {
      if (!['title', 'description'].includes(key) || !Object.hasOwn(schema, key)) throw new Error(`Orphan translation at ${location}/${key}`);
    }
  }
  for (const key of ['$defs', 'properties', 'patternProperties', 'dependentSchemas']) {
    for (const [name, child] of Object.entries(schema[key] ?? {})) count += validateAnnotations(child, `${location}/${key}/${name}`);
  }
  for (const key of ['oneOf', 'allOf', 'anyOf', 'prefixItems']) {
    for (const [index, child] of (schema[key] ?? []).entries()) count += validateAnnotations(child, `${location}/${key}/${index}`);
  }
  for (const key of ['items', 'additionalProperties', 'unevaluatedProperties', 'contains', 'not', 'if', 'then', 'else', 'propertyNames']) {
    if (schema[key] !== undefined) count += validateAnnotations(schema[key], `${location}/${key}`);
  }
  return count;
}
