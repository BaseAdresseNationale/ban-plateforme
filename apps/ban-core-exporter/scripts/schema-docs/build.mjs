import {cp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import JsonSchemaStaticDocs from 'json-schema-static-docs';
import {registerTemplateHelpers} from './schema-template.mjs';
import {languages, messages, t, validateAnnotations} from './locales.mjs';
import {layout, navigation, redirect} from './site.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '../..');
const output = path.join(appRoot, 'dist/schema-docs');
const contract = path.join(appRoot, 'specifications/ban-diff/v0.4');
const require = createRequire(import.meta.url);
const libraryRoot = path.dirname(require.resolve('json-schema-static-docs/package.json'));
const dsfrRoot = path.dirname(require.resolve('@gouvfr/dsfr/package.json'));
const schemaNames = (await readdir(path.join(contract, 'schemas'))).filter(name => name.endsWith('.schema.json')).sort();

// Fail before producing pages if a translation is incomplete or a translated
// guide was not reviewed after its French source changed.
for (const key of new Set(Object.values(messages).flatMap(dictionary => Object.keys(dictionary)))) {
  for (const language of languages) t(language, key);
}
let annotations = 0;
for (const name of schemaNames) annotations += validateAnnotations(JSON.parse(await readFile(path.join(contract, 'schemas', name), 'utf8')), name);
const guideSources = JSON.parse(await readFile(path.join(here, 'content/guide-sources.json'), 'utf8'));
for (const {source, sha256, translation} of guideSources) {
  const content = await readFile(path.resolve(here, source));
  if (createHash('sha256').update(content).digest('hex') !== sha256) throw new Error(`English guide requires review: ${translation} (source changed: ${source})`);
  if (!(await readFile(path.join(here, translation), 'utf8')).trim()) throw new Error(`Empty guide: ${translation}`);
}
console.log(`${annotations} titles/descriptions checked in English and French.`);

async function generate(destination, native, language = 'en') {
  registerTemplateHelpers(language);
  await new JsonSchemaStaticDocs({
    inputPath: path.join(contract, 'schemas'), inputFileGlob: '*.schema.json',
    outputPath: destination,
    templatePath: native ? path.join(libraryRoot, 'templates') : path.join(here, 'template'),
    createIndex: false, displaySchema: false,
    jsonSchemaVersion: 'https://json-schema.org/draft/2020-12/schema',
    // Valid allOf refinements need not repeat type locally. Unknown annotation
    // x-i18n is checked explicitly above, and does not affect instance validation.
    ajvOptions: {strict: false}, resolve: {http: false},
  }).generate();
}

// Only this generated subtree is replaced; keep other exporter build artifacts.
await rm(output, {recursive: true, force: true});
await mkdir(path.join(output, 'assets'), {recursive: true});
await cp(contract, path.join(output, 'sources'), {recursive: true});
for (const name of ['dsfr.min.css', 'fonts', 'icons']) await cp(path.join(dsfrRoot, 'dist', name), path.join(output, 'assets', name), {recursive: true});
await cp(path.join(dsfrRoot, 'LICENSE.md'), path.join(output, 'assets/DSFR-LICENSE.md'));
for (const name of ['docs.css', 'docs.js']) await cp(path.join(here, name), path.join(output, 'assets', name));

const nativeMarkdown = path.join(output, 'native/markdown');
await generate(nativeMarkdown, true);
for (const language of languages) {
  const languageRoot = path.join(output, language);
  await mkdir(path.join(languageRoot, 'native'), {recursive: true});
  const markdownRoot = path.join(languageRoot, 'markdown');
  await generate(markdownRoot, false, language);
  async function page(filename, key, markdown, options) {
    const current = filename.replace(/^native\//, '');
    await writeFile(path.join(languageRoot, filename), layout(language, t(language, key), markdown, current, options));
  }
  for (const name of schemaNames) {
    const filename = name.replace(/\.json$/, '.html');
    const key = name.includes('-full-') ? 'full' : name.includes('-diff-') ? 'diff' : 'definitions';
    await page(filename, key, await readFile(path.join(markdownRoot, name.replace(/\.json$/, '.md')), 'utf8'), {schema: true});
    await page(`native/${filename}`, key, await readFile(path.join(nativeMarkdown, name.replace(/\.json$/, '.md')), 'utf8'), {native: true});
  }
  for (const [filename, key, source] of [
    ['index.html', 'home', `content/${language}/index.md`],
    ['evaluation.html', 'evaluation', language === 'fr' ? 'evaluation.md' : 'content/en/evaluation.md'],
    ['specification.html', 'specification', language === 'fr' ? '../../specifications/ban-diff/v0.4/specifications/SPECIFICATION_BAN_DIFF_V0.4.md' : 'content/en/specification.md'],
    ['correspondances.html', 'correspondences', language === 'fr' ? '../../specifications/ban-diff/v0.4/analyse/CORRESPONDANCES_STANDARD_ADRESSE.md' : 'content/en/correspondances.md'],
  ]) {
    const markdown = (await readFile(path.resolve(here, source), 'utf8'))
      .replaceAll('../analyse/CORRESPONDANCES_STANDARD_ADRESSE.md', 'correspondances.html')
      .replaceAll('../fixtures/administrative/README.md', '../sources/fixtures/administrative/README.md');
    await page(filename, key, markdown);
  }
  let examples = `# ${t(language, 'examples')}\n\n${t(language, 'examplesIntro')}\n`;
  for (const name of ['ban-standard-full-v0.4.ndjson', 'ban-standard-diff-v0.4.ndjson', 'ban-standard-created-disabled-v0.4.ndjson']) {
    examples += `\n## ${name}\n\n[${t(language, 'download')}](../sources/fixtures/${name})\n\n\`\`\`json\n${await readFile(path.join(contract, 'fixtures', name), 'utf8')}\n\`\`\`\n`;
  }
  await page('examples.html', 'examples', examples);
}

// Keep previously shared URLs working, including JSON Pointer anchors.
for (const [filename] of navigation) await writeFile(path.join(output, filename), redirect(`fr/${filename}`));
for (const name of schemaNames) {
  const filename = name.replace(/\.json$/, '.html');
  await writeFile(path.join(output, 'native', filename), redirect(`../fr/native/${filename}`));
}
console.log(`\nDocumentation prête : ${output}/index.html (fr/ et en/)`);
