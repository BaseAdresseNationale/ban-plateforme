# Specification normative BAN et DIFF v0.4

## Portée et conventions

Cette specification définit les exports BAN complets et DIFF. **DOIT** exprime une obligation. Deux sérialisations du même modèle existent : `raw`, référence à clés anglaises, et `standard-fr`, à clés françaises. Un flux est du NDJSON UTF-8 : un objet JSON par ligne.

`uuid` est un UUID canonique minuscule. `datetime` est RFC 3339 UTC. Un champ non applicable est absent ; `null` signifie « applicable mais inconnu » ; un tableau existant n'est jamais `null`.

## Flux

La première ligne est `{ "meta": { "note": "stream-start", ... } }` et la dernière est `{ "meta": { "note": "stream-end", ... } }`.

| Raw ouverture | Standard FR ouverture | Type | Règle |
| --- | --- | --- | --- |
| `meta.formatVersion` | `metadonnees.versionFormat` | string | `0.4` |
| `meta.exportType` | `metadonnees.typeExport` | string | `ban` ou `diff` |
| `meta.format` | `metadonnees.format` | string | `raw` ou `standard-fr` |
| `meta.dataTypes` | `metadonnees.typesDonnees` | string[] | Types exportés |
| `meta.departments` | `metadonnees.departements` | string[] | Filtres département |
| `meta.at` | `metadonnees.a` | datetime | obligatoire pour un full |
| `meta.from`, `meta.to` | `metadonnees.de`, `metadonnees.a` | datetime | obligatoires pour un DIFF |
| `meta.addressIds`, `toponymIds`, `districtIds` | `metadonnees.idsAdresses`, `idsOdonymes`, `idsCommunes` | uuid[] | facultatifs |

Un DIFF couvre `[from, to)` : `from` est inclus et `to` exclu. La clôture porte uniquement `generatedAt` / `genereLe` (`datetime`) et `stats` / `statistiques`. En DIFF, chaque compteur de type porte `count`, `created`, `updated`, `disabled` ; `count` est leur somme.

## Enveloppes

Un full porte une ligne `{ "type": "address", "nodeKey": "ADDRESS:::uuid", "data": { ... } }`. `nodeKey` est facultatif, technique et non métier.

Un DIFF porte `{ "event": "updated", "type": "address", "data": [{...}, {...}] }`.

| Raw | Standard FR | Type | Règle |
| --- | --- | --- | --- |
| `event` | `evenement` | string | `created`, `updated`, `disabled` |
| `type` | `type` | string | Raw : `district`, `toponym`, `address` ; FR : `commune`, `odonyme`, `adresse` |
| `data` | `donnees` | object[] | 1 état pour created/disabled ; 2 états `[après, avant]` pour updated |

Un objet apparaît au plus une fois par DIFF. Les modifications intermédiaires sont consolidées : `data[0]` est le dernier état avant `to`; `data[1]` est l'état juste avant `from`. Les créations/mises à jour sont ordonnées district, toponyme, adresse ; les désactivations, adresse, toponyme, district.

## Champs communs

| Raw | Standard FR | Type | Obligatoire | Règle |
| --- | --- | --- | --- | --- |
| `labels` | `libelles` | object[] | oui | non vide ; premier élément de référence |
| `labels[].value` | `libelles[].valeur` | string | oui | non vide |
| `labels[].isoCode` | `libelles[].codeIso` | string | oui | ISO 639-3 minuscule |
| `status` | `statut` | string | oui | `active` ou `disabled` |
| `updatedAt` | `dateDerniereMiseAJour` | datetime | oui | date de dernière modification métier |
| `integratedAt` | `dateIntegrationBAN` | datetime/null | oui | première intégration BAN, immuable |
| `meta.insee.cog` | `metadonnees.insee.code` | string | oui | code INSEE courant |
| `meta.source` | `metadonnees.source` | string | oui | une source ; `assemblage` pour une composition |
| `meta.interop.balProvidedKey` | `metadonnees.interop.cleFournieBAL` | string | non | clé BAL |
| `meta.interop.banComputedKey` | `metadonnees.interop.cleCalculeeBAN` | string | non | clé calculée BAN |
| `meta.interop.legacyCsvId` | `metadonnees.interop.idCsvHistorique` | string | non | identifiant CSV historique |

Toutes les métadonnées métier sont dans l'objet, jamais dans l'enveloppe. Le recalcul isolé d'une clé calculée ne produit pas de DIFF.

## District / commune

| Raw | Standard FR | Type | Obligatoire | Règle |
| --- | --- | --- | --- | --- |
| `id` | `idCommune` | uuid | oui | identifiant propre du district |
| `historicalDistrictID` | `idCommuneHistorique` | uuid | non | lien BAN historique |
| `historicalInseeCode` | `codeINSEECommuneHistorique` | string | non | code INSEE historique |

`config` est interdit.

## Toponyme / odonyme

| Raw | Standard FR | Type | Obligatoire | Règle |
| --- | --- | --- | --- | --- |
| `id` | `idOdonyme` | uuid | oui | identifiant propre du toponyme |
| `districtID` | `idCommune` | uuid | oui | référence district |
| `geometry.type` | `geometrie.type` | string | oui | `Point` |
| `geometry.coordinates` | `geometrie.coordonnees` | number[2] | oui | WGS84 `[longitude, latitude]` |
| `historicalDistrictID` | `idCommuneHistorique` | uuid | non | lien historique |
| `historicalInseeCode` | `codeINSEECommuneHistorique` | string | non | code historique |

## Adresse

| Raw | Standard FR | Type | Obligatoire | Règle |
| --- | --- | --- | --- | --- |
| `id` | `idAdresse` | uuid | oui | identifiant propre de l'adresse |
| `districtID` | `idCommune` | uuid | oui | référence district |
| `mainToponymID` | `idOdonyme` | uuid | oui | référence toponyme principal |
| `secondaryToponymIDs` | `idsOdonymesComplementaires` | uuid[] | oui | tableau, vide si aucun |
| `number` | `numero` | integer | non | strictement positif |
| `suffix` | `indiceRepetition` | string | non | non vide |
| `certified` | `certification` | boolean | oui | certification |
| `positions` | `positions` | object[] | oui | non vide ; premier élément principal |
| `positions[].type` | `positions[].type` | string | oui | vocabulaire BAN anglais, ex. `entrance` |
| `positions[].geometry.type` | `positions[].geometrie.type` | string | oui | `Point` |
| `positions[].geometry.coordinates` | `positions[].geometrie.coordonnees` | number[2] | oui | WGS84 `[longitude, latitude]` |
| `postalCodes` | `codesPostaux` | string[] | oui | tableau, vide si inconnu |
| `historicalDistrictID` | `idCommuneHistorique` | uuid | non | lien historique |
| `historicalInseeCode` | `codeINSEECommuneHistorique` | string | non | code historique |

## Contraintes et fixtures

Les références doivent exister dans l'état après application. Un full ne contient que `active`; un `disabled` porte `disabled`. Les clés de ciblage et les changements de configuration sont interdits. Une fusion/absorption est décomposée en événements existants.

La livraison v0.4 DOIT fournir et valider : un full fictif, les trois événements, deux DIFF consécutifs, une fusion, une commune historique, une adresse sans numéro/suffixe, un toponyme secondaire et un recalcul de clé sans événement.
