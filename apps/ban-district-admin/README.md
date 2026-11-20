# ban-district-admin

Commande d’enrichissement administratif d’un district existant. Les données restent dans
`district_admin.context`, liées par UUID au district ; aucun champ BAN, historique ou export
FULL/DIFF n’est modifié. Aucun service réseau permanent ni traitement annuel du COG.

## Utiliser

Node.js 24, pnpm 10.12.4 et `PG_URL` fourni explicitement ; aucun `.env` personnel chargé.
Les packages Prisma doivent être générés/construits selon la procédure du projet.
La migration additive `0013_district_administrative_context` passe par le runner Prisma,
jamais au lancement de la commande. Elle ne dépend pas de la migration postale 0012.

```sh
pnpm --filter @ban/ban-district-admin build
pnpm --filter @ban/ban-district-admin district refresh --district <UUID>
pnpm --filter @ban/ban-district-admin district refresh --district <UUID> --apply
pnpm --filter @ban/ban-district-admin district read --district <UUID>
```

`refresh` simule par défaut ; seul `--apply` écrit. La lecture `read` n’accède à aucune URL.
Le résultat JSON indique `mode` et `status` : `updated`, `unchanged`, `missing`, `ambiguous`,
`stale` ou `failed`. `unchanged` en mode lecture signifie que le contexte est utilisable.
Les autres statuts donnent un code de sortie non nul, sans erreur SQL ni secret exposés.
Un contexte périmé n’est pas retourné comme utilisable ni supprimé ; la commune n’est jamais
réaffectée/désactivée. L’activité et le COG sont revérifiés en transaction après le chargement.

## Référence et données conservées

Source : JSON de [découpage administratif](https://github.com/datagouv/decoupage-administratif).
Version par défaut **6.0.0**, millésime **2026**, vérifiés le 20 novembre 2026. Les trois URL
`https://unpkg.com/@etalab/decoupage-administratif@6.0.0/data/{communes,departements,regions}.json`
sont versionnées. Aucun référentiel n’est installé comme dépendance ou chargé au démarrage.
Redirections refusées, requêtes limitées à 15 s et fichiers à 20 Mio. Chaque exécution fige
version, millésime et empreintes SHA-256 des trois fichiers dans la provenance enregistrée.
`--reference-sha256 <empreinte>` permet d’exiger l’empreinte annoncée lors d’une simulation.
Une autre version exige `--reference-version <version> --millesime <année>` explicites.

Le contexte contient code/nom/type source, département/région, population et codes postaux
lorsqu’ils existent ; zéro et listes vides sont conservés. Nom administratif et labels BAN
restent distincts ; les codes postaux communaux ne remplacent pas le calcul postal par position.
Un COG absent ou ambigu ne produit aucune écriture ; `--type <type-source>` permet une sélection
exacte explicite. Le millésime du référentiel n’est pas l’année de chaque statistique source.

## Droits PostgreSQL

Le rôle de service requiert `USAGE` sur `ban` et `district_admin`, `SELECT` sur les colonnes
`id`, `meta`, `isActive` de `ban.district`, et `SELECT/INSERT/UPDATE` sur sa seule table.
Il n’a besoin d’aucun droit `UPDATE` ou `DELETE` sur BAN. La fonction
`district_admin.lock_district(uuid)` lit/verrouille le district sous le rôle de migration :
`SECURITY DEFINER`, `search_path=pg_catalog`, objets qualifiés, aucun SQL dynamique/écriture BAN.
Son `EXECUTE` est retiré à `PUBLIC` ; l’administrateur doit l’accorder explicitement au rôle de
service. Aucun rôle ni droit n’est créé/accordé automatiquement sur une base existante.
Le schéma et la fonction doivent rester possédés par le rôle de migration, pas le rôle de service.

## Vérifier

```sh
pnpm --filter @ban/ban-district-admin test
pnpm --filter @ban/ban-district-admin exec tsc --noEmit
pnpm --filter @ban/ban-district-admin test:postgres
```

Les unités/imports/contrats fonctionnent sans service. L’intégration opt-in crée son seul
conteneur depuis l’image déjà locale `postgis/postgis:17-3.4`, port loopback libre et stockage
éphémère. Elle vérifie identité/base/rôle avant migration et seed, teste le runner et les droits,
le rejeu concurrent, les lectures CLI et la stabilité exacte des objets/exports BAN, puis ne
supprime que son conteneur identifié. Aucune URL de base utilisateur ni donnée réelle utilisée.
