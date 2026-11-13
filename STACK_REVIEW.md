# Relecture de la stack FULL/DIFF v0.4

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

Base : `feat/ban-diff-v0.4`. Lire le sérialiseur `ban-standard` et ses
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

Lire `ndjson-data-line.helpers.ts`, `ban-standard-formatters.ts` et
`technical-changes.test.ts`. Les exclusions affectent la comparaison, pas les
états diffusés. Une création finale désactivée conserve son événement `created`.
Un recalcul de clé ou une configuration technique seuls peuvent laisser la date
et la clé calculée du consommateur différentes du FULL ; le contenu métier
actif reste la référence. Ce comportement est documenté et testé, pas corrigé
silencieusement pendant la reconstruction.

### Nommage et stockage

Lire `file-naming.ts`, `storage.ts` et les tests associés. Les noms décrivent
le périmètre et les dates de la demande ; le token reste un suffixe de fichier
et l'identifiant du job. FULL et DIFF sont stockés sous le mois de référence
Europe/Paris, sans dossier par token. Les tests S3 sont simulés ; aucun fichier
du stockage réel n'est déplacé ou renommé par la reconstruction.

### Qualifications transversales

`administrative-contract.test.ts` reconstruit les cinq étapes fictives avec le
générateur réel puis applique les DIFF à un consommateur de test indépendant.
Les fichiers `test-support/` sont réservés aux tests, sans route ni export réel.
Les fixtures sont ordonnées `step-0_` à `step-4_`.

Le bootstrap PostgreSQL partagé et le contrôle d'exports vides appartiennent
à cet étage, indépendamment des optimisations. Leur documentation commune est
dans `packages/prisma-client/tests/README.md`. La qualification hors base ne
crée ni base ni données et n'exécute pas ce bootstrap.

## 3. Optimisations — `codex/ban-export-sql-optimizations`

Base : `codex/ban-diff-v0.4-exporter`. Les migrations sont inchangées, avec leurs
tests d'équivalence, diagnostics et retours arrière dans des commits séparés.
La documentation de qualification est dans `README-performance.md`, distincte
du support commun. Ne pas exécuter de benchmark historique sans vérifier ses
préconditions, ni installer une migration par une commande de test.

Premier lot : 0007 reformule la planification des filtres DIFF d'adresses.
Lire `migration.sql`, `address-diff.postgres.test.mjs` et le rollback associé.
Les contrôles de reconstruction sont hors base ; les essais SQL nécessitent
un opt-in et une petite cible dédiée, sans qualification nouvelle de la candidate.

Deuxième lot : 0008 présélectionne les identifiants d'adresses avant le choix
temporel des versions. Les filtres finaux et la priorité courant/historique
sont conservés ; lire les scénarios de chevauchement et bornes à la microseconde.

Troisième lot : 0009 présélectionne les toponymes et résout les codes communes
une fois par requête départementale. Les accès UUID ciblés restent distincts.
Lire le contrôle d'extraction des trois définitions, les chevauchements et les
scénarios de parents absents/désactivés. Les mesures historiques ne sont pas
relancées par cette réorganisation.
