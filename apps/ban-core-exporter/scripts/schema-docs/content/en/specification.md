# FULL and DIFF v0.4 specification

<div class="notice">English documentation translation of the <a href="../fr/specification.html" lang="fr" hreflang="fr">authoritative French specification</a>. In case of a discrepancy, the French version prevails.</div>

## Scope and conventions

This specification defines FULL and DIFF exports in the `ban-standard` format. **MUST** expresses a requirement. A stream is UTF-8 NDJSON: one JSON object per line. `exportType: "full"` identifies a FULL export and `exportType: "diff"` a DIFF export.

- **FULL — complete export**: a snapshot of active objects at instant `at`, for the selected scope.
- **DIFF — differential export**: consolidated changes between inclusive `from` and exclusive `to`: creations, updates and deactivations. It updates a compatible starting state.

The “Recommended French equivalent for a CNIG-inspired standard” columns propose keys for a French representation inspired by the CNIG Address Standard. Each JSON Schema property includes that equivalent in its description, even when the names are identical. States, events and business values follow BAN rules.

Standard schema `title` and `description` annotations are in English; their French translations are stored in `x-i18n.fr`. This project-specific annotation changes no validation constraints, stream keys or values. The French specification remains normative; its English translation in the documentation POC is informative.

The [mappings to the CNIG Address Standard V1 of 28 October 2024](correspondances.html) explain the conceptual relationships and BAN representations: positions grouped in an array, boolean certification, statuses, business timestamps and stream extensions.

`uuid` is a canonical lowercase UUID. `datetime` is RFC 3339 UTC. An inapplicable field is absent; `null` means “applicable but unknown”; an existing array is never `null`.

## Stream

The first line is `{ "meta": { "note": "stream-start", ... } }` and the last is `{ "meta": { "note": "stream-end", ... } }`.

| Opening | Recommended French equivalent for a CNIG-inspired standard | Type | Rule |
| --- | --- | --- | --- |
| `meta.formatVersion` | `metadonnees.versionFormat` | string | `0.4` |
| `meta.exportType` | `metadonnees.typeExport` | string | `full` or `diff` |
| `meta.format` | `metadonnees.format` | string | `ban-standard` only |
| `meta.request.dataTypes` | `metadonnees.requete.typesDonnees` | string[] | Selected types |
| `meta.request.departments` | `metadonnees.requete.departements` | string[] | Selected departments |
| `meta.request.at` | `metadonnees.requete.a` | datetime | Required for FULL |
| `meta.request.from`, `meta.request.to` | `metadonnees.requete.de`, `metadonnees.requete.a` | datetime | Required for DIFF |
| `meta.request.addressIds`, `toponymIds`, `districtIds` | `metadonnees.requete.idsAdresses`, `idsOdonymes`, `idsCommunes` | uuid[] | Optional, internal calls only |

### Request, content and result

`request` is required and describes the **validated selection actually used**, including default values. It is neither a content inventory nor a raw copy of HTTP parameters. A requested identifier may have no result, particularly in DIFF. Business lines are the resulting content; closing counters describe that content, not the number of requested identifiers.

Current FULL/DIFF HTTP routes accept departments, types and dates, but **do not expose UUID filters**. These remain available for internal exporter calls. Their absence means no UUID filter applies; do not include secrets or connection parameters. Default dates are resolved before export and fractional seconds are preserved. Selection parameters are grouped in `meta.request`. `meta.format` identifies the file format and is `ban-standard`; the service fixes the format when producing the stream.

### Validation and selection limits

Each UUID list accepts at most **1,000 received entries**; the three lists accept **2,000 in total**, before deduplication. UUIDs are validated, normalized to lowercase and deduplicated. Exceeding a limit or supplying an invalid UUID results in explicit rejection, never truncation. An absent or `null` UUID list means no filter; an explicitly empty UUID list is rejected to avoid implicitly broadening the selection. Dates are validated with up to six fractional digits and normalized to UTC without losing microseconds; DIFF requires `from < to`.

Types belong to the three contract types (at most three received entries). Departments are two- or three-digit codes, or `2A` / `2B`, with at most 200 received entries; duplicates are removed. A valid code need not exist in the database. For internal calls, an empty department list means no department restriction; HTTP requires a department. Validation occurs before queueing and before exporter execution. These limits guarantee neither a small result set nor bounded SQL execution time. No new global byte limit is introduced.

A DIFF covers `[from, to)`: `from` is inclusive and `to` exclusive. The closing metadata contains only `generatedAt` (`datetime`) and `stats`. In DIFF, each type counter contains `count`, `created`, `updated`, `disabled`; `count` is their sum.

An installed structure without data, an absent department/UUID or a period without events is not an error: the stream contains opening and closing lines, no business lines, and zero counters for all selected types. The order of JSON statistics keys is insignificant. A missing or incompatible structure/function must instead make the export fail; a partial artifact without closing metadata is never a successful empty export. An invalid request remains an error even if it would have selected zero objects.

## Envelopes

A FULL data line is `{ "type": "address", "nodeKey": "ADDRESS:::uuid", "data": { ... } }`. `nodeKey` is optional and technical, not business data.

A DIFF line is `{ "event": "updated", "type": "address", "data": [{...}, {...}] }`.

| BAN key | Recommended French equivalent for a CNIG-inspired standard | Type | Rule |
| --- | --- | --- | --- |
| `event` | `evenement` | string | `created`, `updated`, `disabled` |
| `type` | `type` | string | `district`, `toponym`, `address`; recommended French equivalents: `commune`, `odonyme`, `adresse` |
| `data` | `donnees` | object[] | 1 state for created/disabled; 2 states `[after, before]` for updated |

An object appears at most once per DIFF. Intermediate changes are consolidated: `data[0]` is the latest state before `to`; `data[1]` is the state immediately before `from`. Creations/updates are ordered district, toponym, address; deactivations are ordered address, toponym, district.

### Creation and final status

`event` describes the consolidated change; `status` describes the final state. A `created` event MUST contain a single after state, whose status may be `active` **or `disabled`**. For example, an object absent at the start, created then disabled within the window is published once as `created` with `status: "disabled"`. It is neither omitted nor republished as `disabled` in the same DIFF. Counters classify it only under `created`.

A `disabled` event describes an active → disabled transition and contains a single disabled after state. An `updated` event contains two states, after then before. Status is not inferred solely from the event name; a reactivation may be an update to an active state. An unchanged disabled object must not be emitted again in the next period; a new change may cause it to reappear.

#### Applying a DIFF and consistency with FULL

A FULL contains only active objects. For the same instant and scope, expected consistency concerns the **active view**: applying the DIFF to the starting state must recover the active objects in the final FULL. This rule does not guarantee equality of a registry that also retains disabled objects.

A consumer of an active view MUST examine the final status: a disabled `created` event adds no active object. A consumer retaining disabled records may store that UUID and its state; a FULL alone does not necessarily supply such records. Non-reuse of UUIDs is BAN’s responsibility, not merely a property of the consumer’s memory.

References are checked in the corresponding business registry: references of an active object must resolve in the active view; a disabled record may reference another disabled object absent from the active FULL. Acceptance of a disabled record must not depend on all its parents being present in the active view alone.

## Common fields

| BAN key | Recommended French equivalent for a CNIG-inspired standard | Type | Required | Rule |
| --- | --- | --- | --- | --- |
| `labels` | `libelles` | object[] | yes | Array; may be empty for an address, non-empty for a municipality/toponym |
| `labels[].value` | `libelles[].valeur` | string | yes | Non-empty |
| `labels[].isoCode` | `libelles[].codeIso` | string | yes | Lowercase ISO 639-3 |
| `status` | `statut` | string | yes | `active` or `disabled` |
| `updatedAt` | `dateDerniereMiseAJour` | datetime | yes | Last business modification timestamp |
| `integratedAt` | `dateIntegrationBAN` | datetime/null | yes | Explicitly supplied first BAN integration timestamp; `null` if unknown, no fallback to a BAL revision timestamp |
| `meta.insee.cog` | `metadonnees.insee.code` | string | yes | Current INSEE code |
| `meta.source` | `metadonnees.source` | string | yes | A source; `assemblage` for a composition |
| `meta.interop.balProvidedKey` | `metadonnees.interop.cleFournieBAL` | string | no | BAL key |
| `meta.interop.banComputedKey` | `metadonnees.interop.cleCalculeeBAN` | string | no | BAN-computed key |
| `meta.interop.legacyCsvId` | `metadonnees.interop.idCsvHistorique` | string | no | Legacy CSV identifier |

All business metadata is inside the object, never in the envelope. Recalculating a computed key alone does not produce a DIFF event.

### Technical changes and triggering an `updated` event

Comparison of exported states ignores the BAN-computed key (`meta.interop.banComputedKey`) and last modification timestamp (`updatedAt`). A municipality configuration change is not published and does not by itself trigger a business event, even if it changes the modification timestamp. A changed timestamp alone is therefore not evidence of a business change.

These exclusions affect only the decision to emit an `updated` event. `created` and `disabled` events are not suppressed by this comparison. If a genuine business change accompanies the recalculation or configuration change, both complete states are published with their respective timestamps and keys. The supplied BAL key, legacy CSV identifier, provenance, status, labels, references and geometry are not excluded from comparison.

A DIFF consumer may retain an older computed key or timestamp when a purely technical change was ignored. Consistency with FULL then concerns active objects and their business content, not equality of these technical fields or byte-for-byte equality. A FULL or the next business change supplies their current values. SQL selection remains temporal; this suppression rule applies after conversion and before closing counters.

During serialization, label entries whose `value` is absent, `null` or an empty string are omitted. Other languages and their ordering are preserved, without automatic translation or replacement with French. An address-specific label is optional: if no non-empty labels remain, `labels` is `[]`. No label is constructed from the toponym name or number. Each present entry must have a non-empty value and a valid language code. For a municipality or toponym, no remaining non-empty label is an explicit error; the object is not skipped. This rule changes neither database data nor historical versions. It also applies to before/after states in a DIFF.

## District / municipality

| BAN key | Recommended French equivalent for a CNIG-inspired standard | Type | Required | Rule |
| --- | --- | --- | --- | --- |
| `id` | `idCommune` | uuid | yes | District’s own identifier |
| `historicalDistrictID` | `idCommuneHistorique` | uuid | no | Historical BAN reference |
| `historicalInseeCode` | `codeINSEECommuneHistorique` | string | no | Historical INSEE code |

`config` is forbidden.

## Toponym / odonym

| BAN key | Recommended French equivalent for a CNIG-inspired standard | Type | Required | Rule |
| --- | --- | --- | --- | --- |
| `id` | `idOdonyme` | uuid | yes | Toponym’s own identifier |
| `districtID` | `idCommune` | uuid | yes | District reference |
| `geometry` | `geometrie` | Point/null | yes | `null` if geometry is absent |
| `geometry.type` | `geometrie.type` | string | if geometry is non-null | `Point` |
| `geometry.coordinates` | `geometrie.coordonnees` | number[2] | if geometry is non-null | WGS84 `[longitude, latitude]` |
| `historicalDistrictID` | `idCommuneHistorique` | uuid | no | Historical reference |
| `historicalInseeCode` | `codeINSEECommuneHistorique` | string | no | Historical code |

A missing toponym geometry is accepted for compatibility with historical data; it is represented as `geometry: null`, without omitting the field. This is not a recommendation for new data. The export retains the object without inventing coordinates. A populated geometry MUST be a valid WGS84 `Point`. This tolerance applies to FULL exports and every DIFF state, but not to address positions.

## Address

| BAN key | Recommended French equivalent for a CNIG-inspired standard | Type | Required | Rule |
| --- | --- | --- | --- | --- |
| `id` | `idAdresse` | uuid | yes | Address’s own identifier |
| `districtID` | `idCommune` | uuid | yes | District reference |
| `mainToponymID` | `idOdonyme` | uuid | yes | Main toponym reference |
| `secondaryToponymIDs` | `idsOdonymesComplementaires` | uuid[] | yes | Array, empty when none exist |
| `number` | `numero` | integer | no | Greater than or equal to `0`; see the compatibility note below |
| `suffix` | `indiceRepetition` | string | no | Non-empty |
| `certified` | `certification` | boolean | yes | Certification |
| `positions` | `positions` | object[] | yes | Non-empty; first entry is the main position |
| `positions[].type` | `positions[].type` | string | yes | English BAN vocabulary, e.g. `entrance` |
| `positions[].geometry.type` | `positions[].geometrie.type` | string | yes | `Point` |
| `positions[].geometry.coordinates` | `positions[].geometrie.coordonnees` | number[2] | yes | WGS84 `[longitude, latitude]` |
| `postalCodes` | `codesPostaux` | string[] | yes | Array, empty if unknown |
| `historicalDistrictID` | `idCommuneHistorique` | uuid | no | Historical reference |
| `historicalInseeCode` | `codeINSEECommuneHistorique` | string | no | Historical code |

The address number is optional: an address without a number omits `number`, without substituting `0` or `null`. When present, this field MUST be an integer greater than or equal to `0`; negative numbers are forbidden. The value `0` is accepted only for compatibility with historical data and should not be supplied for new data. It may be forbidden in a later version; no such prohibition applies in v0.4. These rules apply to FULL exports and every DIFF state.

## Constraints and fixtures

References follow the active-view and disabled-record rules above. A FULL contains only `active` objects; a `created` event contains an `active` or `disabled` object, and a `disabled` event contains a `disabled` object. Targeting keys and configuration changes are forbidden. A merger/absorption is decomposed into existing events.

The v0.4 delivery MUST provide and validate: a fictional FULL, all three events, two consecutive DIFFs, a merger, a historical municipality, an address without a number/suffix, a secondary toponym, and a key recalculation without an event.

The [versioned administrative scenario (French)](../sources/fixtures/administrative/README.md) illustrates these cases using three FULL exports and two successive DIFFs. Contract tests reconstruct the final active view and check references, order, states and counters. This qualifies serialization and stream application without a database; it does not validate a real administrative change or the SQL history functions.
