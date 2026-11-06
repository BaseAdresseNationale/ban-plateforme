import {Marked} from 'marked';
import {languages, t} from './locales.mjs';

export const navigation = [
  ['index.html', 'home'],
  ['ban-standard-full-v0.4.schema.html', 'full'],
  ['ban-standard-diff-v0.4.schema.html', 'diff'],
  ['ban-standard-definitions-v0.4.schema.html', 'definitions'],
  ['examples.html', 'examples'], ['specification.html', 'specification'],
  ['correspondances.html', 'correspondences'], ['evaluation.html', 'evaluation'],
];
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

// Only versioned local Markdown and the tool's output are rendered. HTML is
// required by the library's tables and the custom Handlebars template.
export function render(markdown) {
  let heading = 0;
  return new Marked({renderer: {
    heading({tokens, depth}) {
      // Stable across languages; JSON Schema anchors additionally use pointers.
      return `<h${depth} id="heading-${++heading}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
  }}).parse(markdown);
}

export function layout(language, title, markdown, current, {native = false, schema = false} = {}) {
  const text = key => escape(t(language, key));
  const withinLanguage = native ? '../' : '';
  const shared = native ? '../../' : '../';
  const alternate = other => `${shared}${other}/${native ? 'native/' : ''}${current}`;
  return `<!doctype html>
<html lang="${language}" data-fr-scheme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} · ${text('documentation')}</title>
${languages.map(other => `<link rel="alternate" hreflang="${other}" href="${alternate(other)}">`).join('')}
<link rel="stylesheet" href="${shared}assets/dsfr.min.css"><link rel="stylesheet" href="${shared}assets/docs.css">
<script src="${shared}assets/docs.js" defer></script></head><body>
<a class="skip-link" href="#contenu">${text('skip')}</a>
<header class="fr-header"><div class="fr-container header-content"><a class="ban-mark" href="${withinLanguage}index.html" aria-label="BAN — ${text('home')}">BAN</a><div><p class="fr-header__service-title">${text('brand')}</p><p class="fr-header__service-tagline">${text('tagline')}</p></div><span class="fr-badge fr-badge--new">${text('badge')}</span><nav class="language-switcher" aria-label="${text('language')}">${languages.map(other => `<a data-language-switch href="${alternate(other)}" lang="${other}" hreflang="${other}"${other === language ? ' aria-current="true"' : ''}>${other === 'fr' ? 'Français' : 'English'}</a>`).join('')}</nav></div></header>
<div class="fr-container docs-layout"><aside class="sidebar"><nav aria-label="${text('nav')}"><p class="nav-heading">${text('navTitle')}</p><ul>${navigation.map(([href, key]) => `<li><a href="${withinLanguage}${href}"${href === current && !native ? ' aria-current="page"' : ''}>${text(key)}</a></li>`).join('')}</ul></nav><p class="sidebar-note">JSON Schema 2020-12<br>${text('sourceNote')}</p></aside>
<main id="contenu" tabindex="-1"><p class="eyebrow">${text('technical')} / ${escape(title)}</p>
${native ? `<div class="notice">${text('nativeNotice')}</div>` : ''}
${schema ? `<div class="schema-tools"><button class="fr-btn fr-btn--secondary fr-btn--sm" data-expand="true" type="button">${text('expand')}</button><button class="fr-btn fr-btn--tertiary fr-btn--sm" data-expand="false" type="button">${text('collapse')}</button><a href="${shared}sources/schemas/${current.replace('.html', '.json')}">${text('source')}</a><a href="markdown/${current.replace('.html', '.md')}">${text('markdown')}</a></div><p class="schema-help">${text('help')}</p>` : ''}
<article class="doc-content" lang="${native ? 'en' : language}">${render(markdown)}</article><p class="back-top"><a href="#contenu">${text('back')}</a></p></main></div>
<footer class="fr-container docs-footer">Base Adresse Nationale · ${text('footer')}<br><span>${text('credits')}</span></footer></body></html>`;
}

export function redirect(target) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>BAN documentation</title><meta http-equiv="refresh" content="0;url=${target}"><script>location.replace(${JSON.stringify(target)} + location.hash)</script></head><body><a href="${target}">Français / English</a></body></html>`;
}
