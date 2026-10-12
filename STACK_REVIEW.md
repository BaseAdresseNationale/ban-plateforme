# Relecture de la stack BAN/DIFF v0.4

Ce guide distingue le contrat, son implémentation, les optimisations PostgreSQL
et le kit développeurs. Chaque branche se compare à sa parente, pas à `main`.

Le découpage ne change pas les règles métier validées. Les nouvelles dispositions
de fichiers, les validations autonomes et les adaptations documentaires sont
consignées séparément du code applicatif conservé.

## 1. Contrat — `feat/ban-diff-v0.4`

Base : `chore/typescript-config-migration`. Lire la spécification normative,
les schémas et les exemples. Le commit initial `pnpm test` est autonome et
ne change ni le protocole ni les données.

Ce premier étage ajoute le contrat et sa validation autonome ; il n'active pas
la sérialisation v0.4 dans les services hérités. Les tests qui importent le
générateur réel et les scénarios de reconstruction sont dans la branche enfant
`codex/ban-diff-v0.4-exporter`.

Points métier : numéro facultatif ≥ 0, zéro historique, géométrie nulle de
toponyme, libellé propre facultatif d'adresse, statut distinct de l'événement,
consolidation et non-émission technique. Les choix encore ouverts restent
signalés dans la matrice, sans nouvelle règle implicite.

Validation : `pnpm test` et compilation des services. Les tests de contrat
ne nécessitent ni Docker, ni base, ni S3. Une validation de schéma n'est pas une
qualification SQL ou une politique exhaustive des mutations administratives.

## 2. Implémentation — `codex/ban-diff-v0.4-exporter`

Base : `feat/ban-diff-v0.4`. Lire les sérialiseurs Raw/Standard FR et leurs
régressions, puis la validation de sélection, la comparaison DIFF, le nommage et
le stockage, enfin les tests transversaux. Les règles sont celles du contrat,
sans nouvel arbitrage métier lié au découpage.

Les premières fonctions de formatage et leur fermeture de fichier sûre sont
livrées ensemble ; les filtres, le stockage et les qualifications sont isolés
dans les commits suivants. La migration fonctionnelle 0006 reste dans cet étage.
Les migrations de performance 0007–0009 sont sur la branche enfant SQL.

### Sélection et migration fonctionnelle

Les filtres UUID sont internes ; l'API publique n'en expose pas de nouveaux.
Les listes et périodes sont validées avant mise en file et avant exécution ;
les microsecondes sont préservées. Lire `packages/tools/src/export-selection.ts`
et les tests des routes/consommateur pour les valeurs par défaut et les limites.
La migration 0006 normalise les arguments de filtre et reste inchangée par
rapport à la version déjà appliquée. La compilation et les tests n'appliquent
aucune migration. Le workflow Prisma de déploiement reste une opération distincte.

### Événements et changements techniques

Lire `ndjson-data-line.helpers.ts`, les deux sérialiseurs et
`technical-changes.test.ts`. Les exclusions affectent la comparaison, pas les
états diffusés. Une création finale désactivée conserve son événement `created`.
Un recalcul de clé ou une configuration technique seuls peuvent laisser la date
et la clé calculée du consommateur différentes du FULL ; le contenu métier
actif reste la référence. Ce comportement est documenté et testé, pas corrigé
silencieusement pendant la reconstruction.
