# Fusion fictive et deux DIFF successifs

## Objectif

Ces petits flux illustrent l'application de deux DIFF v0.4 à un FULL initial.
Le département **96 et toutes les communes et données
sont fictifs**. Ce n'est ni un export de données réelles ni un script d'import
PostgreSQL. Le scénario est indépendant du kit de jeu de test département 96.

Le choix illustratif est de créer un nouvel UUID de commune pour la commune
réunie et de désactiver les deux anciennes. Les UUID des toponymes et adresses
transférés restent stables. Cet exemple ne définit pas une politique universelle
d'attribution des UUID pour toutes les mutations administratives.

## Fichiers et chronologie

Chaque nom ci-dessous existe avec le suffixe `.ban-standard.ndjson`.
Les préfixes `step-0_` à `step-4_` conservent l'ordre
chronologique lors d'un tri alphabétique. Les bornes sont à minuit Europe/Paris,
UTC+02:00.

| Fichier | Date ou période | Contenu |
| --- | --- | --- |
| `step-0_full-start` | 6 avril 2026 | Deux communes, deux toponymes et deux adresses actifs. |
| `step-1_diff-first` | [6 avril, 13 avril) | Création de la commune réunie et d'une adresse, transfert des toponymes/adresses, désactivation des anciennes communes : 8 événements. |
| `step-2_full-middle` | 13 avril 2026 | Une commune, deux toponymes et trois adresses actifs. |
| `step-3_diff-second` | [13 avril, 20 avril) | Renommage de commune/toponyme, nouvelle voie et adresses, certification, désactivation d'une adresse : 7 événements publiés. |
| `step-4_full-end` | 20 avril 2026 | Une commune, trois toponymes et trois adresses actifs. |

La première fenêtre publie les anciens UUID/codes INSEE dans
`historicalDistrictID` / `historicalInseeCode`, ainsi que le code courant de la
commune réunie.
La nouvelle adresse a un toponyme secondaire. Les fixtures incluent une adresse
sans numéro, une adresse sans libellé, un numéro `0` et une géométrie de toponyme
nulle : les deux derniers sont des cas de compatibilité historique, pas des
recommandations pour de nouvelles données.

Dans la seconde fenêtre, une adresse créée puis désactivée est publiée une
seule fois comme `created`, au statut `disabled`. Son UUID reste dans le registre
des traces, mais elle n'apparaît pas dans le FULL actif final. Les anciennes
communes déjà désactivées ne sont pas réémises sans nouvelle modification.

## Application et champs techniques

Le consommateur initialise son registre avec `step-0_full-start`, applique
`step-1_diff-first`, puis `step-3_diff-second`. Les créations précèdent les mises à jour ; dans chaque groupe,
les communes précèdent les toponymes puis les adresses. Les désactivations
respectent l'ordre inverse. Les références actives restent résolues après chaque
ligne ; les changements administratifs sont consolidés à la fin de la fenêtre.

La première application retrouve exactement `step-2_full-middle`. La seconde retrouve
les mêmes objets actifs et le même contenu métier que `step-4_full-end`, mais pas
nécessairement les mêmes dates de modification et clés calculées BAN :
un recalcul isolé de clé, accompagné d'une nouvelle date, est volontairement
absent du DIFF. Le FULL conserve ces valeurs courantes. Cette différence est
explicitement contrôlée, pas masquée par une comparaison des seuls UUID.
Une modification métier simultanée reste publiée avec ses deux états complets.

## Vérifications reproductibles

Depuis la racine du dépôt :

```sh
pnpm --filter @ban/ban-core-exporter test
pnpm --filter @ban/ban-core-exporter build
```

Dans la branche enfant `codex/ban-diff-v0.4-exporter`,
`src/export/administrative-contract.test.ts` vérifie les cinq fichiers : schémas de
ligne, cadrage, compteurs, périodes contiguës, sérialisation,
ordre et références, états après/avant, reconstruction des vues actives et
création désactivée. Le consommateur de test rejette aussi l'application des
fenêtres dans l'ordre inverse, une création en doublon et un UUID avant/après
incohérent.

Les sources fictives se trouvent dans
`src/export/test-support/administrative-scenario.ts`. Le constructeur
`administrative-streams.ts` utilise les sérialiseurs, compteurs et tampon d'ordre
de production, avec un curseur simulé. Les tests comparent son résultat aux
fichiers versionnés ; modifier une règle exige de relire les exemples associés.
La date de génération des exemples est fixe afin de les rendre déterministes.

Sur l'étage contrat seul, `src/export/specification-validation.test.ts` valide
les schémas de ligne et le cadrage/compteurs des fichiers versionnés. Les
constructeurs de scénario ne sont pas nécessaires à cette validation autonome.

## Limites

Aucun accès à PostgreSQL, RabbitMQ ou S3 n'est nécessaire. Ces tests ne
qualifient ni la sélection SQL aux bornes exactes, ni les triggers d'historisation,
ni l'exécution d'une fusion dans la BDD. Ils démontrent le contrat de flux et son
application dans ce scénario fictif. Les cas légaux ou historiques supplémentaires
doivent être ajoutés et validés séparément.
