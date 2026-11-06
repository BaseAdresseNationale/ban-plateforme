# Evaluate the documentation POC

This prototype uses **json-schema-static-docs 0.28.1**, **marked** for HTML previews, and locally served **DSFR** styles and fonts. The three versioned schemas remain the sources of the reference. No BAN services or database access are required.

## Compare the two outputs

| Schema | BAN template | Original library template |
| --- | --- | --- |
| FULL | [Adapted reference](ban-standard-full-v0.4.schema.html) | [Original FULL output](native/ban-standard-full-v0.4.schema.html) |
| DIFF | [Adapted reference](ban-standard-diff-v0.4.schema.html) | [Original DIFF output](native/ban-standard-diff-v0.4.schema.html) |
| Shared definitions | [Adapted reference](ban-standard-definitions-v0.4.schema.html) | [Original definitions output](native/ban-standard-definitions-v0.4.schema.html) |

The original output is retained without documentation fixes, in the source language (English). Both outputs are converted to HTML and use the same interface.

## Findings about the original output

- The shared definitions page does not expand the types under `$defs`.
- Alternatives are displayed using numeric paths that are difficult to read.
- Required fields are not identified in nested objects within the FULL/DIFF alternatives.
- Positional elements under `prefixItems` are not expanded in the default template, even though the library accepts draft 2020-12.
- Some zero-valued constraints and boolean rules such as `items: false` are not displayed.
- Some property anchors do not match the generated headings.

Accepting and validating a schema is therefore insufficient to produce a complete reference.

## Adaptations

The POC uses the library’s public `templatePath` option. A Handlebars template and a few helpers traverse `unresolvedSchema`, provided by its template API, to display definitions, properties, alternatives, constraints and references.

`$ref` values become links; descriptions alongside references are preserved. Compositions remain explicit, without merging or inferring constraints. The values `0`, `false` and `null` remain visible. “Not required by this block” does not mean that another `allOf` block cannot require the field.

Click to expand a section; following a reference also opens its parent sections. Generated Markdown uses HTML `details` and `table` elements: it is not plain Markdown. Links to HTML pages are intended for this local preview.

## Things to try

1. In the definitions, open `$defs / point` then `properties / coordinates`: check both positions, coordinate limits and `items: false`.
2. Open `$defs / address`, follow the compositions and check `number` with `minimum: 0`; this block does not require the number.
3. In `$defs / toponym`, check that `geometry` is required and may be `null` through an alternative.
4. In FULL, follow `districtLine → data → allOf / 1 → properties / status`: the value must be `active`.
5. In DIFF, open `mkUpdatedAddress → data → prefixItems`: positions 0 and 1 must reference the address type. The specification and stream validator additionally define the after/before ordering and exact cardinality.
6. Try links between files, the “Expand all” button and a narrow window.

## Provisional assessment

**The tool is usable with an adapted template, but its original output is insufficient for these BAN schemas.** This POC makes it possible to assess whether the maintenance cost of the adaptation is acceptable. The template uses a structure exposed by the library; its version is pinned and links in the adapted output are automatically checked.

The project is small and licensed under GPL-3.0. Dependencies remain development dependencies; no runtime changes to the microservice are needed. This POC does not demonstrate support for every possible JSON Schema keyword or full RGAA accessibility compliance.

## Bilingual documentation and checks

Standard `title` and `description` annotations are in English. French translations are stored in the project-specific `x-i18n.fr` annotation. Keys, contract values and CNIG identifiers remain unchanged. The interface, introduction, evaluation and guides are available in both languages. The original library output remains in English and is explicitly identified as such.

Generation fails if a schema translation or interface message is missing. The English guide translations are tied to hashes of their French sources: changes require reviewing the translation and updating the recorded hash. This check detects source changes, not the linguistic correctness of a translation. The French specification remains authoritative.

## References

- [json-schema-static-docs documentation](https://tomcollins.github.io/json-schema-static-docs/)
- [Library source code and license](https://github.com/tomcollins/json-schema-static-docs)
- [Official DSFR palette](https://www.systeme-de-design.gouv.fr/version-courante/fr/fondamentaux/couleurs)

The [contract specification](specification.html) and NDJSON validator remain necessary for rules that apply to the entire stream.
