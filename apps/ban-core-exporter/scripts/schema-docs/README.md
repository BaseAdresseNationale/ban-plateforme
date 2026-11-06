# POC de documentation JSON Schema

Branche de départ : `codex/export-streaming-storage`. Le POC ne requiert ni
`.env`, ni PostgreSQL, ni RabbitMQ, ni S3. Il ne lance pas le microservice.

Depuis la racine du dépôt, avec Node.js 24 et pnpm 10 :

```sh
pnpm install --frozen-lockfile
pnpm --filter @ban/ban-core-exporter run docs:preview
```

Ouvrir **http://127.0.0.1:4178/fr/** ou **http://127.0.0.1:4178/en/**.
La racine redirige vers le français. Le serveur écoute uniquement sur la boucle
locale. `Ctrl+C` l’arrête. Si le port est occupé :

```sh
DOCS_PORT=4179 pnpm --filter @ban/ban-core-exporter run docs:preview
```

Pour produire les fichiers sans serveur et contrôler le résultat :

```sh
pnpm --filter @ban/ban-core-exporter run docs:build
pnpm --filter @ban/ban-core-exporter run docs:check
```

Le contrôle régénère la documentation, vérifie les contraintes sensibles de BAN,
les liens/ancres des deux langues, la couverture des traductions, les sections et
littéraux techniques des guides, et les copies exactes des schémas sources. Les
ancres défectueuses du rendu natif sont conservées pour la comparaison.

## Ce qui est généré

Le dossier ignoré `apps/ban-core-exporter/dist/schema-docs/` contient :

- les trois références HTML par langue sous `fr/` et `en/`, avec leur Markdown
  sous `fr/markdown/` et `en/markdown/` ;
- le rendu natif anglais de la bibliothèque, sous `fr/native/` et `en/native/`
  (interface dans la langue choisie, contenu explicitement marqué anglais) ;
- une introduction, les exemples NDJSON, la spécification et les correspondances CNIG ;
- les sources du contrat sous `sources/` ;
- les styles, polices et icônes DSFR locaux sous `assets/`.

L’aperçu ne dépend d’aucun CDN. La génération lit les schémas locaux, et la
résolution HTTP des `$ref` est désactivée. Après une modification d’un schéma ou
d’un modèle, relancer la commande de prévisualisation pour reconstruire les pages
(pas de surveillance automatique des fichiers).

## Évaluation

Lire [evaluation.md](./evaluation.md), également accessible depuis le menu de
l’aperçu. Il distingue les capacités du rendu natif des corrections du modèle BAN.

La bibliothèque **json-schema-static-docs 0.28.1** valide les schémas 2020-12 et
expose un modèle Handlebars personnalisable. Son modèle natif omet néanmoins des
informations essentielles sur ce contrat. Le modèle `template/schema.hbs` utilise
`unresolvedSchema` fourni par la bibliothèque ; `schema-template.mjs` apporte la
navigation par JSON Pointer et l’affichage des contraintes sans les fusionner.
Le coût de maintenance de cette adaptation fait partie de l’évaluation du POC.

Les dépendances sont figées et ajoutées uniquement en développement :
`json-schema-static-docs`, `handlebars`, `marked`, `@gouvfr/dsfr`. Le DSFR fournit
la palette et la typographie ; ce POC ne constitue pas une certification de
conformité DSFR ou RGAA. La bibliothèque documentaire est sous GPL-3.0.

## Convention de langue

Les annotations standard `title` et `description` sont en anglais. Leur version
française est portée par `x-i18n.fr` dans chaque sous-schéma documenté :

```json
{
  "type": "string",
  "format": "uuid",
  "description": "Canonical BAN identifier.",
  "x-i18n": {
    "fr": {
      "description": "Identifiant BAN canonique."
    }
  }
}
```

`x-i18n` est une annotation propre à BAN, pas une fonctionnalité multilingue
normalisée par JSON Schema. Un validateur AJV strict doit l’autoriser explicitement,
par exemple avec `ajv.addKeyword('x-i18n')`. Les règles de validation restent
indépendantes des langues. Les noms techniques des clés, les valeurs du contrat,
les données des fixtures et les identifiants du standard CNIG restent identiques.

Le modèle choisit les textes avec `locales.mjs` et échoue si une traduction manque,
sans repli silencieux. Les menus, boutons et autres textes d’interface partagent
un dictionnaire vérifié dans les deux langues. Le sélecteur conserve page et
ancre ; les ancres de schéma sont dérivées des JSON Pointer et les ancres des
guides de la position des titres, indépendamment de leur traduction.

Les guides anglais sont dans `content/en/`. La spécification française reste
normative ; la version anglaise porte explicitement cette distinction. Le fichier
`content/guide-sources.json` contient l’empreinte SHA-256 de chaque source française.
Si une source change, relire et adapter sa traduction, puis remplacer l’empreinte
par celle de la source mise à jour. Ne pas actualiser les empreintes sans relecture.
La génération refuse les empreintes périmées ; elle ne démontre pas la qualité
linguistique des traductions. Elle ne détecte pas non plus une traduction française
de schéma devenue sémantiquement périmée : relire les deux langues ensemble.

L’audit initial des schémas comptait 136 descriptions françaises et 15 anglaises.
Les 151 descriptions et 3 titres sont désormais disponibles dans les deux langues.
La migration a vérifié que les mots-clés de validation restent identiques. Le code
d’exécution du microservice ne change pas ; son test documentaire contrôle aussi
les correspondances CNIG dans les deux langues. Les règles inter-lignes restent
dans la spécification et le validateur NDJSON existants.
