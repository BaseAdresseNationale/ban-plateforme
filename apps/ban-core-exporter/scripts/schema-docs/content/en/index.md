# BAN exports, documented at the source

Explore the structure of data published by the French National Address Database (Base Adresse Nationale): fields, types, constraints and shared definitions.

<div class="notice">This bilingual reference is generated from the three JSON Schemas of contract v0.4. The specification covers additional rules that apply to the entire stream.</div>

<div class="contract-cards"><a class="contract-card" href="ban-standard-full-v0.4.schema.html"><span class="card-label">FULL</span><strong>A complete snapshot</strong><span>Active objects at a given instant: municipalities, toponyms and addresses.</span><span class="card-link">Explore the contract →</span></a><a class="contract-card" href="ban-standard-diff-v0.4.schema.html"><span class="card-label">DIFF</span><strong>Consolidated changes</strong><span>Creations, updates and deactivations between two instants.</span><span class="card-link">Explore the contract →</span></a></div>

## Reading a stream

An NDJSON file contains one JSON object per line. The first line opens the stream; the last supplies the statistics.

| Stage | FULL | DIFF |
| --- | --- | --- |
| Opening | `stream-start`, selection and snapshot instant `at` | `stream-start`, selection and period `[from, to)` |
| Content | One active object per line | One consolidated event per object |
| Closing | `stream-end` and counters | `stream-end` and counters by event |

For an `updated` DIFF event, the array contains **the after state, then the before state**. The `created` and `disabled` events contain one state. Cardinality rules are also checked by the stream validator.

## Getting started

- Explore the [shared definitions](ban-standard-definitions-v0.4.schema.html), particularly `address`, `toponym` and `district`.
- Read the [NDJSON examples](examples.html) from the repository fixtures.
- Read the [contract specification](specification.html) for line ordering, uniqueness and statistical consistency.
- Compare the original and BAN outputs in the [POC evaluation](evaluation.html).

## Documentation languages

English is the source language of schema `title` and `description` annotations. Their French translations are stored in `x-i18n.fr`. JSON keys, contract values, example data and CNIG standard identifiers are not translated.

The Français / English switch keeps the current page and definition. Interface text and descriptions are provided in both languages; missing translations are never silently substituted. The French specification remains authoritative; the English version is a documentation translation.
