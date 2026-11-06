# Évaluer le POC documentaire

Ce prototype utilise **json-schema-static-docs 0.28.1**, **marked** pour l’aperçu HTML, et les styles et polices du **DSFR** servis localement. Les trois schémas versionnés restent les sources de la référence. Aucun service BAN ni accès aux données n’est nécessaire.

## Comparer les deux rendus

| Schéma | Modèle BAN | Modèle natif de la bibliothèque |
| --- | --- | --- |
| FULL | [Référence adaptée](ban-standard-full-v0.4.schema.html) | [Rendu natif FULL](native/ban-standard-full-v0.4.schema.html) |
| DIFF | [Référence adaptée](ban-standard-diff-v0.4.schema.html) | [Rendu natif DIFF](native/ban-standard-diff-v0.4.schema.html) |
| Définitions partagées | [Référence adaptée](ban-standard-definitions-v0.4.schema.html) | [Rendu natif des définitions](native/ban-standard-definitions-v0.4.schema.html) |

Le rendu natif est conservé sans correction documentaire, dans la langue source (anglais). Les deux rendus sont convertis en HTML et habillés par la même interface.

## Constats sur le rendu natif

- La page des définitions partagées ne développe pas les types sous `$defs`.
- Les alternatives sont présentées avec des chemins numériques difficiles à lire.
- Les obligations ne sont pas affichées dans les objets imbriqués des alternatives FULL/DIFF.
- Les éléments positionnels sous `prefixItems` ne sont pas développés dans le modèle par défaut, bien que la bibliothèque accepte le draft 2020-12.
- Certaines contraintes à zéro et les règles booléennes telles que `items: false` ne sont pas affichées.
- Certaines ancres de propriétés ne correspondent pas aux titres générés.

Accepter et valider un schéma ne suffit donc pas à en produire une référence complète.

## Adaptation réalisée

Le POC passe par l’option publique `templatePath` de la bibliothèque. Un modèle Handlebars et quelques helpers parcourent `unresolvedSchema`, fourni par son API de modèle, pour afficher les définitions, propriétés, alternatives, contraintes et références.

Les `$ref` deviennent des liens ; les descriptions portées à côté d’une référence sont conservées. Les compositions restent explicites, sans fusion ni déduction des contraintes. Les valeurs `0`, `false` et `null` restent visibles. L’indication « Non exigé par ce bloc » ne signifie pas qu’un autre bloc d’un `allOf` n’impose pas le champ.

Les sections se déplient au clic ; suivre une référence ouvre aussi les sections parentes. Le Markdown généré utilise des éléments HTML `details` et `table` : ce n’est pas du Markdown pur. Le rendu des liens vers les pages HTML est prévu pour cet aperçu local.

## Points à essayer

1. Dans les définitions, ouvrir `$defs / point` puis `properties / coordinates` : vérifier les deux positions, les bornes et `items: false`.
2. Ouvrir `$defs / address`, suivre les compositions et vérifier `number` avec `minimum: 0` ; le numéro n’est pas exigé dans ce bloc.
3. Dans `$defs / toponym`, vérifier que `geometry` est obligatoire et peut valoir `null` via une alternative.
4. Dans FULL, suivre `districtLine → data → allOf / 1 → properties / status` : la valeur doit être `active`.
5. Dans DIFF, ouvrir `mkUpdatedAddress → data → prefixItems` : les positions 0 et 1 doivent pointer vers le type adresse. Le sens après/avant et la cardinalité exacte sont complétés par la spécification et le validateur de flux.
6. Essayer les liens entre fichiers, le bouton « Tout déplier » et une fenêtre étroite.

## Avis provisoire

**L’outil est utilisable avec un modèle adapté, mais son rendu natif est insuffisant pour ces schémas BAN.** Ce POC permet d’évaluer si le coût de maintenance de cette adaptation est acceptable. Le modèle utilise une structure exposée par la bibliothèque ; la version est figée et les liens du rendu adapté sont contrôlés automatiquement.

Le projet est de petite taille et sous licence GPL-3.0. Les dépendances restent dans les dépendances de développement ; aucune modification du microservice en exécution n’est nécessaire. Ce POC ne démontre pas la couverture de tous les mots-clés possibles de JSON Schema ni une conformité RGAA complète.

## Documentation bilingue et contrôles

Les annotations standard `title` et `description` sont en anglais. Les traductions françaises sont stockées dans l’annotation propre au projet `x-i18n.fr`. Les clés, valeurs du contrat et identifiants CNIG restent identiques. L’interface, l’introduction, l’évaluation et les guides ont leurs deux versions. Le rendu natif de la bibliothèque reste en anglais et est explicitement signalé.

La génération échoue si une traduction de schéma ou un message d’interface manque. Les traductions anglaises des guides sont liées aux empreintes de leurs sources françaises : une modification impose une relecture et la mise à jour de l’empreinte enregistrée. Ce contrôle détecte un changement de source, pas la justesse linguistique d’une traduction. La spécification française reste la référence normative.

## Références

- [Documentation de json-schema-static-docs](https://tomcollins.github.io/json-schema-static-docs/)
- [Code source et licence de la bibliothèque](https://github.com/tomcollins/json-schema-static-docs)
- [Palette officielle du DSFR](https://www.systeme-de-design.gouv.fr/version-courante/fr/fondamentaux/couleurs)

La [spécification normative](specification.html) et le validateur NDJSON restent nécessaires pour les contraintes portant sur le flux entier.
