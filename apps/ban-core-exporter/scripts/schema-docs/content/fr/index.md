# Les exports BAN, documentés à la source

Consultez la structure des données publiées par la Base Adresse Nationale : champs, types, contraintes et définitions communes.

<div class="notice">Cette référence bilingue est générée depuis les trois JSON Schema du contrat v0.4. La spécification complète les règles qui portent sur l’ensemble du flux.</div>

<div class="contract-cards"><a class="contract-card" href="ban-standard-full-v0.4.schema.html"><span class="card-label">FULL</span><strong>Une photographie complète</strong><span>Les objets actifs à un instant donné : communes, toponymes et adresses.</span><span class="card-link">Explorer le contrat →</span></a><a class="contract-card" href="ban-standard-diff-v0.4.schema.html"><span class="card-label">DIFF</span><strong>Les changements consolidés</strong><span>Créations, mises à jour et désactivations entre deux instants.</span><span class="card-link">Explorer le contrat →</span></a></div>

## Lire un flux

Un fichier NDJSON contient un objet JSON par ligne. La première ligne ouvre le flux ; la dernière fournit les statistiques.

| Étape | FULL | DIFF |
| --- | --- | --- |
| Ouverture | `stream-start`, sélection et instant `at` | `stream-start`, sélection et période `[from, to)` |
| Contenu | Un objet actif par ligne | Un événement consolidé par objet |
| Clôture | `stream-end` et compteurs | `stream-end` et compteurs par événement |

Pour un événement DIFF `updated`, le tableau contient **l’état après, puis l’état avant**. Les événements `created` et `disabled` contiennent un état. Les règles de cardinalité sont aussi contrôlées par le validateur de flux.

## Pour commencer

- Explorez les [définitions partagées](ban-standard-definitions-v0.4.schema.html), notamment `address`, `toponym` et `district`.
- Consultez les [exemples NDJSON](examples.html) issus des fixtures du dépôt.
- Lisez la [spécification normative](specification.html) pour l’ordre des lignes, l’unicité et la cohérence des statistiques.
- Comparez le rendu natif et le modèle BAN dans [l’évaluation du POC](evaluation.html).

## Langues de la documentation

L’anglais est la langue source des `title` et `description` des schémas. Leur traduction française est stockée dans `x-i18n.fr`. Les clés JSON, valeurs de contrat, données d’exemple et identifiants du standard CNIG ne sont pas traduits.

Le sélecteur Français / English conserve la page et la définition consultées. Les textes de l’interface et les descriptions ont leurs deux versions ; aucune traduction manquante n’est remplacée silencieusement. La spécification française reste la référence normative ; la version anglaise en est une traduction documentaire.
