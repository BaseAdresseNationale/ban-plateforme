# Correspondances documentaires BAN Standard / Standard Adresse

Ce guide propose des noms de clés pour une représentation française inspirée du
Standard Adresse CNIG V1 du 28 octobre 2024. Il rapproche les propriétés BAN des
concepts du standard et précise les choix de représentation propres au flux.

## Équivalents français conseillés

Chaque propriété définie dans les schémas, y compris les répétitions et les
propriétés utilisant `$ref`, porte son équivalent conseillé dans `description`.
Cette proposition de nommage constitue un profil français inspiré du CNIG ;
les correspondances conceptuelles ci-dessous détaillent les adaptations BAN.

| Clé BAN | Équivalent conseillé pour un Standard-FR-CNIG |
|---|---|
| `meta` | `metadonnees` |
| `note` | `note` |
| `formatVersion` | `versionFormat` |
| `exportType` | `typeExport` |
| `format` | `format` |
| `request` | `requete` |
| `dataTypes` | `typesDonnees` |
| `departments` | `departements` |
| `at` | `a` |
| `from` | `de` |
| `to` | `a` |
| `addressIds` | `idsAdresses` |
| `toponymIds` | `idsOdonymes` |
| `districtIds` | `idsCommunes` |
| `generatedAt` | `genereLe` |
| `stats` | `statistiques` |
| `count` | `count` |
| `created` | `created` |
| `updated` | `updated` |
| `disabled` | `disabled` |
| `type` | `type` (sens précisé selon enveloppe, géométrie ou position) |
| `nodeKey` | `nodeKey` |
| `data` | `donnees` |
| `event` | `evenement` |
| `id` | `idCommune`, `idOdonyme` ou `idAdresse` selon l'entité |
| `labels` | `libelles` |
| `value` | `valeur` |
| `isoCode` | `codeIso` |
| `status` | `statut` |
| `updatedAt` | `dateDerniereMiseAJour` |
| `integratedAt` | `dateIntegrationBAN` (première intégration explicitement connue, sinon `null`) |
| `insee` | `insee` |
| `cog` | `code` |
| `source` | `source` |
| `interop` | `interop` |
| `balProvidedKey` | `cleFournieBAL` |
| `banComputedKey` | `cleCalculeeBAN` |
| `legacyCsvId` | `idCsvHistorique` |
| `historicalDistrictID` | `idCommuneHistorique` |
| `historicalInseeCode` | `codeINSEECommuneHistorique` |
| `districtID` | `idCommune` |
| `geometry` | `geometrie` |
| `coordinates` | `coordonnees` |
| `mainToponymID` | `idOdonyme` |
| `secondaryToponymIDs` | `idsOdonymesComplementaires` |
| `number` | `numero` |
| `suffix` | `indiceRepetition` |
| `certified` | `certification` |
| `positions` | `positions` |
| `postalCodes` | `codesPostaux` |

Les équivalents français conseillés des types d'entité et clés de compteurs
`district`, `toponym`, `address` sont respectivement `commune`, `odonyme`, `adresse`.
Les événements sont `created`, `updated`, `disabled` et les statuts `active`, `disabled`.

## Correspondances conceptuelles et représentations BAN

Référence : Standard Adresse CNIG V1 du 28 octobre 2024.

- Adresse : `AdresseCommunale`, identifiant `idAdresseCommunale` (p. 24).
  `idAdresse` est le nom conseillé dans le profil français.
- Communes : code INSEE et nom/langue (p. 27-30). L'UUID de commune est un
  identifiant BAN, expliqué dans l'annexe B (p. 54-55).
- Toponymes : classe abstraite `Odonyme`, voie/place/lieudit principal et
  lieudit complémentaire (p. 31-33). Une géométrie propre au toponyme est une
  propriété BAN attachée au toponyme.
- Libellés de commune/toponyme : `nom` et `nomMultilingue`, type `NomLangue`.
  Le libellé propre facultatif d'adresse est une propriété BAN. Le CNIG définit
  également `complementAdresse` pour une `AdresseComplementaire` (p. 35).
- Positions : `position` et `positionComplementaire`, type `Position` avec
  géométrie `GM_Point` et type (p. 25-26). BAN utilise un tableau ordonné ;
  première position principale, suivantes complémentaires.
- Certification : code CNIG numérique extensible, 0/1 actuellement (p. 26, 40).
  La représentation BAN est un booléen.
- Statut : cycle de vie `TypeStatut` (p. 38-39). Les valeurs BAN sont `active` et `disabled`.
- Numéro et indice : classe `Numero` facultative (p. 34). BAN accepte zéro
  pour la compatibilité historique ; un numéro positif est recommandé.
- Codes postaux : `ZonePostale.codePostal` (p. 30-31), représenté par un tableau BAN.
- Coordonnées : deux dimensions en WGS84, à la précision fournie.
  Les recommandations de précision figurent aux pages 40-41 du standard.
- Dates de validité CNIG : `dateDebut` / `dateFin` (p. 26-27, 33).
  BAN expose les dates métier de modification (`updatedAt`) et de première
  intégration (`integratedAt`).
- Flux NDJSON, événements DIFF, filtres, compteurs, clés techniques et
  interopérabilité : extensions de publication BAN.

## Temporalité de première intégration

`integratedAt` est la date de première intégration explicitement fournie à la
sérialisation, ou `null` si elle est inconnue. Le producteur garantit l'origine
et l'immuabilité des valeurs connues. `updatedAt` porte la date de modification.
