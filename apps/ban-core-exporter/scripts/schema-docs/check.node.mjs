import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {annotation, languages, messages, t, validateAnnotations} from './locales.mjs';
import {render} from './site.mjs';

const app = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(app, 'dist/schema-docs');
execFileSync(process.execPath, [fileURLToPath(new URL('./build.mjs', import.meta.url))], {cwd: app, stdio: 'pipe'});
const definitions = await readFile(path.join(output, 'fr/ban-standard-definitions-v0.4.schema.html'), 'utf8');

function block(html, pointer) {
  const id = `node-${Buffer.from(pointer).toString('base64url')}`;
  const start = html.indexOf(`id="${id}"`);
  assert.notEqual(start, -1, `Bloc absent : ${pointer}`);
  const end = html.indexOf('</details>', start);
  return html.slice(start, end);
}

test('la référence conserve les contraintes sensibles du contrat BAN', async () => {
  const coordinates = block(definitions, '/$defs/point/properties/coordinates');
  assert.match(coordinates, /Obligatoire dans cet objet/);
  assert.match(coordinates, /<code>items<\/code>[\s\S]*?<code>false<\/code>/);
  assert.match(block(definitions, '/$defs/point/properties/coordinates/prefixItems/0'), /<code>-180<\/code>/);
  assert.match(block(definitions, '/$defs/point/properties/coordinates/prefixItems/1'), /<code>90<\/code>/);
  const number = block(definitions, '/$defs/address/allOf/1/properties/number');
  assert.match(number, /Non exigé par ce bloc/);
  assert.match(number, /<code>minimum<\/code>[\s\S]*?<code>0<\/code>/);
  assert.match(block(definitions, '/$defs/toponym/allOf/1/properties/geometry'), /Obligatoire dans cet objet/);
  assert.match(block(definitions, '/$defs/toponym/allOf/1/properties/geometry/anyOf/1'), /&quot;null&quot;/);
  assert.match(block(definitions, '/$defs/address'), /<code>unevaluatedProperties<\/code>[\s\S]*?<code>false<\/code>/);
  const full = await readFile(path.join(output, 'fr/ban-standard-full-v0.4.schema.html'), 'utf8');
  assert.match(block(full, '/$defs/districtLine/properties/data/allOf/1/properties/status'), /<code>&quot;active&quot;<\/code>/);
  const diff = await readFile(path.join(output, 'fr/ban-standard-diff-v0.4.schema.html'), 'utf8');
  for (const index of [0, 1]) {
    assert.match(block(diff, `/$defs/mkUpdatedAddress/properties/data/prefixItems/${index}`), /ban-standard-definitions-v0\.4\.schema\.html#/);
  }
});

test('tous les liens et ancres du rendu adapté pointent vers une cible existante', async () => {
  const pages = (await Promise.all(languages.map(async language => (await readdir(path.join(output, language)))
    .filter(name => name.endsWith('.html')).map(name => `${language}/${name}`)))).flat();
  let checked = 0;
  for (const name of pages) {
    const html = await readFile(path.join(output, name), 'utf8');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, `Ancres dupliquées : ${name}`);
    for (const [, href] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(https?:|mailto:)/.test(href)) continue;
      const url = new URL(href, `https://docs.local/${name}`);
      const target = path.join(output, decodeURIComponent(url.pathname));
      const content = await readFile(target, 'utf8');
      // Native rendering is deliberately retained with its known broken anchors.
      // The adapted site's links to those pages must still load real files.
      if (url.hash) {
        const fragment = decodeURIComponent(url.hash.slice(1));
        assert.ok(content.includes(`id="${fragment}"`), `Ancre absente : ${name} → ${href}`);
      }
      checked++;
    }
  }
  assert.ok(checked > 400, `Nombre de liens contrôlés inattendu : ${checked}`);
  console.log(`${checked} liens et ressources contrôlés sur ${pages.length} pages adaptées.`);
});

test('les deux langues couvrent les annotations, sans repli silencieux', async () => {
  let count = 0;
  for (const name of (await readdir(path.join(app, 'specifications/ban-diff/v0.4/schemas'))).filter(name => name.endsWith('.json'))) {
    const schema = JSON.parse(await readFile(path.join(app, 'specifications/ban-diff/v0.4/schemas', name), 'utf8'));
    count += validateAnnotations(schema, name);
    const missing = structuredClone(schema);
    delete missing['x-i18n'].fr.description;
    assert.throws(() => validateAnnotations(missing), /Missing fr translation/);
    for (const language of languages) {
      const html = await readFile(path.join(output, language, name.replace('.json', '.html')), 'utf8');
      assert.match(html, new RegExp(`<html lang="${language}"`));
      const uuid = name.includes('definitions') ? block(html, '/$defs/uuid') : null;
      if (uuid) assert.ok(uuid.includes(language === 'en' ? 'Canonical BAN identifier.' : 'Identifiant BAN canonique.'));
      assert.doesNotMatch(html, /<code>x-i18n<\/code>/, 'Les traductions ne sont pas des contraintes');
    }
  }
  assert.equal(count, 154);
  assert.throws(() => annotation({description: 'English'}, 'description', 'fr'), /Missing fr translation/);
  assert.throws(() => t('en', 'unknown_key'), /Missing interface translation/);
  assert.deepEqual(Object.keys(messages.fr).sort(), Object.keys(messages.en).sort());
});

test('les cibles du sélecteur de langue conservent toutes les ancres', async () => {
  const names = (await readdir(path.join(output, 'fr'))).filter(name => name.endsWith('.html'));
  for (const name of names) {
    const french = await readFile(path.join(output, 'fr', name), 'utf8');
    const english = await readFile(path.join(output, 'en', name), 'utf8');
    const anchors = html => [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]).sort();
    assert.deepEqual(anchors(english), anchors(french), `Ancres différentes : ${name}`);
    assert.ok(french.includes(`data-language-switch href="../en/${name}"`));
    assert.ok(english.includes(`data-language-switch href="../fr/${name}"`));
  }
});

test('les traductions des guides préservent les champs techniques et les sections', async () => {
  const sources = JSON.parse(await readFile(new URL('./content/guide-sources.json', import.meta.url), 'utf8'));
  for (const {source, translation} of sources) {
    const french = await readFile(new URL(source, import.meta.url), 'utf8');
    const english = await readFile(new URL(translation, import.meta.url), 'utf8');
    const inlineCode = markdown => new Set([...markdown.matchAll(/`([^`\n]+)`/g)].map(match => match[1]));
    // Every literal referenced by the French guide must also be explained by its
    // English translation. The two illustrative after/before arrays are prose.
    for (const value of inlineCode(french)) {
      if (value === '[après, avant]') continue;
      assert.ok(inlineCode(english).has(value), `Littéral perdu : ${translation} → ${value}`);
    }
    const headingCount = markdown => [...render(markdown).matchAll(/id="heading-/g)].length;
    assert.equal(headingCount(english), headingCount(french), `Sections perdues : ${translation}`);
  }
});

test('les trois schémas sources publiés sont des copies exactes', async () => {
  for (const name of (await readdir(path.join(app, 'specifications/ban-diff/v0.4/schemas'))).filter(name => name.endsWith('.json'))) {
    assert.deepEqual(await readFile(path.join(output, 'sources/schemas', name)), await readFile(path.join(app, 'specifications/ban-diff/v0.4/schemas', name)));
  }
  const css = await readFile(path.join(output, 'assets/dsfr.min.css'), 'utf8');
  assert.match(css, /DSFR v1\.15\.4/);
  await readFile(path.join(output, 'assets/fonts/Marianne-Regular.woff2'));
});
