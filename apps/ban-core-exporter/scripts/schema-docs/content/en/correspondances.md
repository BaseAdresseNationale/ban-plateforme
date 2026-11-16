# BAN Standard / Address Standard documentation mappings

<div class="notice">English translation of the <a href="../fr/correspondances.html" lang="fr" hreflang="fr">French mapping guide</a>. French class names, attribute identifiers and proposed keys are retained because they refer to the CNIG standard.</div>

This guide proposes keys for a French representation inspired by the CNIG Address Standard V1 of 28 October 2024. It relates BAN properties to standard concepts and explains stream-specific representation choices.

## Recommended French equivalents

Every property defined in the schemas, including repetitions and properties using `$ref`, includes its recommended equivalent in `description` (English text) and `x-i18n.fr.description` (French text). This naming proposal forms a French profile inspired by CNIG; the conceptual mappings below explain BAN adaptations.

| BAN key | Recommended French equivalent for a CNIG-inspired standard |
| --- | --- |
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
| `type` | `type` (meaning depends on envelope, geometry or position) |
| `nodeKey` | `nodeKey` |
| `data` | `donnees` |
| `event` | `evenement` |
| `id` | `idCommune`, `idOdonyme` or `idAdresse`, depending on the entity |
| `labels` | `libelles` |
| `value` | `valeur` |
| `isoCode` | `codeIso` |
| `status` | `statut` |
| `updatedAt` | `dateDerniereMiseAJour` |
| `integratedAt` | `dateIntegrationBAN` (explicitly known first integration, otherwise `null`) |
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

The recommended French equivalents of entity types and counter keys `district`, `toponym`, `address` are respectively `commune`, `odonyme`, `adresse`. Events are `created`, `updated`, `disabled`; statuses are `active`, `disabled`.

## Conceptual mappings and BAN representations

Reference: CNIG Address Standard V1 of 28 October 2024.

- Address: `AdresseCommunale`, identifier `idAdresseCommunale` (p. 24). `idAdresse` is the recommended name in the French profile.
- Municipalities: INSEE code and name/language (pp. 27–30). The municipality UUID is a BAN identifier, explained in Annex B (pp. 54–55).
- Toponyms: abstract class `Odonyme`, main street/square/locality and additional locality (pp. 31–33). A toponym’s own geometry is a BAN-specific property attached to the toponym.
- Municipality/toponym labels: `nom` and `nomMultilingue`, type `NomLangue`. An optional address-specific label is a BAN property. CNIG also defines `complementAdresse` for an `AdresseComplementaire` (p. 35).
- Positions: `position` and `positionComplementaire`, type `Position` with `GM_Point` geometry and type (pp. 25–26). BAN uses an ordered array: the first position is the main one, and subsequent positions are additional.
- Certification: extensible numeric CNIG code, currently 0/1 (pp. 26, 40). BAN represents this as a boolean.
- Status: `TypeStatut` lifecycle (pp. 38–39). BAN values are `active` and `disabled`.
- Number and suffix: optional `Numero` class (p. 34). BAN accepts zero for compatibility with historical data; a positive number is recommended.
- Postal codes: `ZonePostale.codePostal` (pp. 30–31), represented as a BAN array.
- Coordinates: two dimensions in WGS84, preserving supplied precision. Accuracy recommendations are on pages 40–41 of the standard.
- CNIG validity dates: `dateDebut` / `dateFin` (pp. 26–27, 33). BAN exposes business modification (`updatedAt`) and first integration (`integratedAt`) timestamps.
- NDJSON stream, DIFF events, filters, counters, technical keys and interoperability: BAN publication extensions.

## First integration timestamp

`integratedAt` is the first integration timestamp explicitly supplied to serialization, or `null` if unknown. The producer guarantees the origin and immutability of known values. `updatedAt` is the modification timestamp.
