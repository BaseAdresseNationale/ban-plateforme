# Catalogue du jeu de test du département 96

Ce catalogue est séparé du guide d'utilisation. Il décrit une version **relue**
du jeu partagé, pas le fonctionnement des scripts. Aucun événement réel n'est
déduit des seules versions historiques.

## Informations à compléter avant partage

- Version/date de l'export et empreintes des fichiers JSON et SQL.
- Communes présentes : UUID, codes INSEE fictifs et noms relus.
- Effectifs courants et historiques par type d'objet.
- Éventuelles anonymisations et dates décalées.

## Événements métier à qualifier

Pour chaque scénario (création, renommage, fusion, division, désactivation),
consigner la date précise, les UUID avant/après, les références concernées,
la règle métier, les résultats attendus des snapshots et des diff et le test
qui les vérifie. Ne pas inventer de fusion ou division pour remplir ce fichier.

Les scénarios de `packages/prisma-client/tests/support/synthetic-fixture.mjs`
sont entièrement synthétiques : ils ne constituent pas l'inventaire métier
des communes réelles du jeu fictif exporté.
