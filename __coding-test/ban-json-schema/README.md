# BAN Schemas (composition)

## Installer
```bash
npm install
```

## Valider un export (snapshot)
```bash
node scripts/validate.mjs schemas/ban-export.schema.json examples/ban-export.example.json
```

## Valider un diff (events[])
```bash
node scripts/validate.mjs schemas/ban-diff.schema.json examples/ban-diff.example.json
```

## Valider un diff (groupé)
```bash
node scripts/validate.mjs schemas/ban-diff-grouped.schema.json examples/ban-diff-grouped.example.json
```

> `schemas/common.defs.schema.json` est chargé en premier (`addSchema`) pour résoudre les `$ref`.

## Valider un diff (groupé) – edge-cases
```bash
node scripts/validate.mjs schemas/ban-diff-grouped.schema.json examples/ban-diff-grouped.edge-cases.json
```
