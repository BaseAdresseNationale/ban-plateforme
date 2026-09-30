# Matrice de décision BAN et DIFF

## Objet et méthode

Ce document transforme les matériaux fournis en décisions de contrat. Il couvre uniquement la structure, la sémantique et le format des échanges ; les modalités de diffusion, les services et l'outillage de lecture sont hors périmètre à ce stade.

Les statuts employés sont les suivants :

- **Confirmé** : une règle explicite, répétée ou compatible avec l'export BAN observé.
- **À intégrer** : attente utilisateur claire, à traduire en règle normative dans la specification.
- **À arbitrer** : information incomplète, contradictoire, ou choix d'architecture encore nécessaire.
- **À exclure** : comportement qui ne doit pas déclencher ou alimenter un DIFF.

## Sources examinées

- `DRAFT # Format BAN.md` : brouillon initial du modèle logique BAN et DIFF.
- `NY150xcQHDcMn6-Kk3zsL.ban.raw.ndjson` : export BAN Raw NDJSON fictif, 1 district, 16 toponymes et 21 adresses.
- `20260417_Debrief_tests_dintegration_DIFF.docx` : retours d'intégration, notamment DGFiP, Enedis et Altitude Infra.
- `Specification_du_format_differentiel_associe_au_format_BAN_STD.docx` : brouillon de specification DIFF v0.4.
- `Review fichier différentiel fev2026 (1).docx` : revue fonctionnelle du DIFF.
- `review spec diff v0.4.xlsx` : suivi de finalisation et confirmations de conception.

## Décisions et exigences de format

| ID | Sujet | Statut | Règle à retenir | Conséquence pour la specification et le générateur |
| --- | --- | --- | --- | --- |
| D-01 | Support de transport | Confirmé | BAN et DIFF sont des flux **NDJSON** : un objet JSON autonome par ligne. | Définir le schéma de la ligne d'ouverture, des lignes de données et de la ligne de clôture. Ne pas présenter le tableau JSON monolithique comme format de transport. |
| D-02 | Bornes du flux | Confirmé | Tout flux a une première ligne `stream-start` et une dernière `stream-end`. L'export BAN observé respecte déjà cette convention. | Rendre ces deux lignes obligatoires et imposer leur cohérence (version, filtre, format, période, types de données). |
| D-03 | Statistiques de clôture | À intégrer | La ligne finale fournit les compteurs par type de données et, pour le DIFF, par événement `created`, `updated`, `disabled`. | Le générateur doit compter les lignes réellement émises et les tests doivent vérifier les compteurs. |
| D-04 | Etat de référence | Confirmé | Un DIFF ne s'applique qu'à un export complet, à un instant de référence connu. Le full sert à l'initialisation et à la resynchronisation. | Le DIFF doit exposer une période explicite `from` / `to` et la spec doit définir les règles d'application et de reprise. |
| D-05 | Types d'événements | Confirmé | Le DIFF publie `created`, `updated` et `disabled`. | Fixer cette énumération, sans type implicite ni événement non documenté. |
| D-06 | Charge utile d'un événement | Confirmé | `created` contient le seul état après ; `updated` contient deux états dans l'ordre **après puis avant** ; `disabled` contient l'état après, désactivé. | Définir une cardinalité normative de `datas` : 1 pour `created`/`disabled`, 2 pour `updated`, avec la sémantique par indice. |
| D-07 | Désactivation et statut | Confirmé | `event` décrit l'opération DIFF ; `status` décrit l'état de l'objet. Le full ne publie que les objets actifs ; le DIFF peut diffuser un objet au statut `disabled`. | Définir le nom, les valeurs autorisées et la portée de `status` à partir du standard BAN. |
| D-08 | Autonomie du DIFF | À intégrer | Les voies et les adresses doivent porter directement le code INSEE, afin d'être exploitables sans résolution préalable de l'identifiant de commune. | Ajouter un champ INSEE obligatoire dans les représentations DIFF de toponyme et d'adresse ; ne pas se contenter de `districtID`. |
| D-09 | Commune historique | À intégrer | Le modèle doit pouvoir exprimer une commune historique, même si l'échantillon ne couvre pas ce cas. | Définir le champ, sa nullabilité, son code INSEE éventuel et au moins un exemple de test non nul. |
| D-10 | Mouvements administratifs | À arbitrer | Fusion, absorption et autres mutations de communes sont attendues dans le jeu de tests, mais leur type d'événement n'est pas défini. | Concevoir un scénario fictif complet ; décider si ces mutations utilisent les trois événements existants ou un événement dédié, puis documenter les effets en cascade. |
| D-11 | Changements de configuration de commune | À exclure | Les changements techniques de configuration (certificat, logo, etc.) ne doivent pas produire de DIFF métier. | Filtrer ces changements dans le générateur ; ajouter des tests de non-régression. |
| D-12 | Commune supprimée / état inconnu | À arbitrer | La revue demande d'écarter les lignes « commune supprimée » ou de les isoler dans un groupe/événement `unknown`. | Ne pas émettre ce cas dans le contrat v1 sans règle de consommation explicite ; l'isoler dans le registre des cas administratifs. |
| D-13 | Identifiants BAN | Confirmé | Les UUID BAN restent les identifiants de référence et servent aux relations entre district, toponyme et adresse. | Conserver les relations explicites et valider leur intégrité dans chaque full et DIFF. |
| D-14 | `nodeKey` | Confirmé | `nodeKey` est facultatif et réservé aux usages de développement ou de diagnostic. Il ne constitue pas un identifiant métier et ne doit jamais servir de référence entre objets. | Le schéma l'autorise dans l'enveloppe NDJSON, mais le générateur et les consommateurs doivent fonctionner en son absence. |
| D-15 | Clé d'interopérabilité | Confirmé | Les trois clés nécessaires sont publiées dans `meta`, sous des noms distincts : clé fournie par la BAL, clé calculée par la BAN et identifiant historique d'export CSV. | Définir les trois noms, leur provenance, leur nullabilité et leur stabilité. La publication ne préjuge pas de leur rôle dans le déclenchement d'un `updated`. |
| D-16 | Clé de ciblage | Confirmé | Les clés de ciblage sont exclues du DIFF. | Ne pas les produire dans les lignes de données ni dans les métadonnées de DIFF v1. |
| D-17 | Nommage des entités | Confirmé | Deux sérialisations sont maintenues sur un modèle logique unique : `raw` anglais, format de référence ; `standard-fr` français, format d'interopérabilité nécessaire à court terme. | Produire une table de correspondance normative champ par champ et garantir l'équivalence métier des deux formats. |
| D-18 | Libellés multilingues | À intégrer | Les listes de libellés et de noms multilingues sont pluriels et doivent accepter plusieurs langues. | Stabiliser `labels` comme tableau ; documenter ISO 639-3, la valeur par défaut et les règles de déduplication. |
| D-19 | Position et géométrie | À intégrer | Le format BAN Raw réel utilise GeoJSON et des valeurs de type de position en anglais (`entrance`, `unit identifier`). | Fixer la géométrie GeoJSON, le CRS, l'ordre longitude/latitude, les types autorisés et la précision. Éviter les synonymes français dans les valeurs techniques. |
| D-20 | Période temporelle du DIFF | Confirmé | La période couverte est l'intervalle semi-ouvert `[from, to)`, exprimé en UTC RFC 3339 : `from` est inclus et `to` est exclu. | Formuler explicitement cette règle dans la specification et fournir deux DIFF consécutifs comme exemple sans chevauchement ni trou. |
| D-21 | Version | Confirmé | La specification porte un numéro de version ; l'état documenté est v0.4. | Définir la politique de compatibilité et les conditions de rupture ; `meta.v` doit avoir une signification normative. |
| D-22 | Exemples et tests | À intégrer | Les consommateurs demandent un full et un DIFF fictifs qui couvrent tous les cas, avec avant/après. | Publier des fixtures versionnées et automatiser leur validation dans le projet de génération. |
| D-23 | Valeurs de `status` | Confirmé | La v1 limite `status` à `active` et `disabled`. Les statuts liés aux signalements relèveront d'une évolution de format. | Définir cette énumération fermée et rejeter toute autre valeur dans les validateurs v1. |
| D-24 | Commune historique | Confirmé | Le lien historique et le code INSEE historique sont deux champs distincts : `historicalDistrictID` et `historicalInseeCode`. | Aligner les deux sérialisations sur cette règle, avec des champs optionnels et un exemple non nul. |
| D-25 | Mutation administrative | Confirmé | Fusion, absorption et changement administratif utilisent seulement `created`, `updated` et `disabled`. Aucun événement `unknown` ou `administrative-change` n'est introduit en v1. | Définir l'ordre d'application et publier une fixture complète expliquant les effets sur districts, toponymes et adresses. |
| D-26 | Déclenchement par une clé calculée | À arbitrer | Les clés calculées restent diffusées, mais un recalcul technique peut produire un faux `updated`. | Décider si le recalcul seul est un événement publiable ou une mise à jour ignorée ; couvrir le choix par une fixture. |
| D-27 | Recalcul technique de clé | Confirmé | Le recalcul isolé d'une clé BAN ne produit pas d'événement `updated`. Les clés restent publiées dans `meta` lors des événements métier. | Exclure ce cas de la détection d'écart et créer une fixture de non-émission. |
| D-28 | Dates d'objet | Confirmé | Chaque objet porte `updatedAt`, date de dernière modification utilisée pour le DIFF, et `integratedAt`, date de première intégration BAN immuable. | Utiliser ces noms et la même sémantique dans les deux sérialisations. |
| D-29 | Absence, inconnue et listes | Confirmé | Un champ non applicable est absent. `null` signifie qu'un champ applicable a une valeur explicitement inconnue. Les tableaux présents sont toujours des tableaux, éventuellement vides. | Faire respecter cette convention par les schémas et les fixtures ; interdire les tableaux à `null`. |
| D-30 | Charge utile DIFF | Confirmé | Une ligne DIFF porte une clé `data` toujours sous forme de tableau : un état pour `created` et `disabled`, deux états `[après, avant]` pour `updated`. | Utiliser ce contrat dans les deux sérialisations et valider strictement la cardinalité selon `event`. |
| D-31 | Ordre du flux DIFF | Confirmé | Pour les créations et mises à jour : districts, puis toponymes, puis adresses. Pour les désactivations : ordre inverse. | Garantir cet ordre dans le générateur afin qu'un consommateur puisse appliquer le flux directement. |
| D-32 | Géométrie v1 | Confirmé | Les positions d'adresse et la géométrie de toponyme sont des GeoJSON `Point` en WGS84, coordonnées `[longitude, latitude]`. | Rejeter les autres types de géométrie dans les validateurs v1 ; documenter les bornes de coordonnées et la précision. |
| D-33 | Libellés | Confirmé | `labels` est obligatoire et non vide. Son premier élément constitue le libellé de référence ; les suivants sont des traductions ou variantes. | Définir le type de langue, l'ordre et l'absence de doublon sans ajouter de champ de sélection. |
| D-34 | Toponymes d'une adresse | Confirmé | `mainToponymID` est obligatoire. `secondaryToponymIDs` est toujours présent et vaut `[]` en l'absence de toponyme secondaire. | Prévoir le nom équivalent dans chaque sérialisation et valider l'existence de toutes les références. |
| D-35 | Emplacement des métadonnées | Confirmé | Toutes les métadonnées métier de l'objet, dont INSEE, provenance et interopérabilité, sont dans `data.meta`. L'enveloppe de ligne est réservée au transport. | Normaliser le Raw existant et placer les codes INSEE requis dans chaque état d'objet DIFF. |
| D-36 | Etat d'activité | Confirmé | `status` remplace `isActive` dans les deux sérialisations. Les objets du full ont `status: "active"`. | Ne pas produire de champ d'activité redondant ; valider que le full ne contient pas d'objet désactivé. |
| D-37 | Standard FR | Confirmé | Le `standard-fr` traduit les noms de champs métier et les valeurs d'entité. Le Raw anglais demeure la référence. | Publier une table de correspondance normative exhaustive, sans différence de sémantique ni de cardinalité. |
| D-38 | Certification | Confirmé | La certification d'une adresse est un booléen obligatoire : `certified` en Raw et `certification` en Standard FR. | Rejeter une valeur absente, nulle ou hors booléen dans les validateurs. |
| D-39 | Positions d'adresse | Confirmé | `positions` est un tableau non vide. Le premier élément est la position principale ; les suivants sont complémentaires. | Préserver l'ordre et valider la présence d'au moins une position GeoJSON `Point`. |
| D-40 | Codes postaux | Confirmé | `postalCodes` est toujours un tableau de chaînes, éventuellement vide lorsqu'aucun code n'est connu. | Utiliser le même type dans les deux sérialisations ; ne jamais émettre une chaîne ou `null` à sa place. |
| D-41 | Numéro et suffixe | Confirmé | `number` et `suffix` sont tous deux facultatifs, car une adresse peut ne porter ni numéro ni suffixe. | Définir `number` comme entier positif lorsqu'il est présent et `suffix` comme chaîne lorsqu'il est présent. |
| D-42 | Provenance | Confirmé | `data.meta.source` est une chaîne unique. Lorsqu'un objet résulte de la combinaison de plusieurs données, sa valeur est `assemblage`. | Définir le vocabulaire contrôlé de provenance ; ne pas produire de tableau de sources. |
| D-43 | Configuration de district | Confirmé | `config` ne fait pas partie des formats BAN et DIFF v1. | Ne pas publier ni comparer cette donnée dans le générateur v1. |
| D-44 | Code INSEE courant | Confirmé | `data.meta.insee.cog` est obligatoire sur district, toponyme et adresse. | Valider ce champ dans tous les états d'objet, y compris les états avant/après d'un `updated`. |
| D-45 | Horodatage de flux | Confirmé | Le full porte `at` et `generatedAt`. Le DIFF porte `from`, `to` et `generatedAt`. | Définir `at` comme instant de photographie et `generatedAt` comme instant de production. |
| D-46 | Lignes de métadonnées | Confirmé | `stream-start` porte version, type, format, filtres et période. `stream-end` porte `stats` et `generatedAt` seulement. | Ne pas répéter les filtres dans la ligne finale. |
| D-47 | Consolidation dans un DIFF | Confirmé | Un objet ne produit qu'une ligne par fenêtre DIFF : état final puis état antérieur au début de la fenêtre. | Consolider les changements intermédiaires avant sérialisation et vérifier l'unicité d'objet dans les fixtures. |

## Écarts constatés entre le brouillon initial et le BAN Raw observé

| Domaine | Brouillon initial | Export Raw observé | Orientation retenue |
| --- | --- | --- | --- |
| Enveloppe | Document JSON avec tableaux `districts`, `toponyms`, `addresses` | Flux NDJSON : ouverture, enregistrements `{ data, meta, type, nodeKey }`, clôture | Séparer modèle logique et sérialisation NDJSON. |
| Référence de voie | `mainToponymID` / `secondaryToponymIDs` | `mainCommonToponymID` / `secondaryCommonToponymIDs` | Choisir un nom canonique ; conserver `Common` seulement s'il porte une distinction métier réelle et documentée. |
| Toponyme | `positions[]` | `geometry` unique | Déterminer si plusieurs positions sont requises ; sinon converger vers la géométrie unique observée. |
| Activité | non définie | `isActive` présent sur chaque objet | Relier explicitement `isActive` au mécanisme DIFF et à la règle de `disabled`. |
| Temporalité | `legalityDate`, `BETA_lastRecordDate` | `updateDate`, `range_validity` | Ne pas cumuler sans sémantique ; normaliser avant implémentation. |
| Métadonnées INSEE | prévues dans la donnée | portées dans l'enveloppe de l'exemple Raw | Pour le DIFF, rendre le code INSEE de voie/adresse directement disponible conformément à D-08. |

## Arbitrages nécessaires avant la specification normative

1. Définir le traitement des mutations administratives et le devenir des objets associés.
2. Définir `cleCiblage`, ou la retirer intégralement du contrat v1.
3. Normaliser les dates et la période d'un DIFF.
4. Définir la table de correspondance exhaustive entre `raw` et `standard-fr`.

## Critères de sortie pour l'étape suivante

La specification BAN et DIFF pourra être rédigée lorsque chaque arbitrage ci-dessus aura une décision ou sera explicitement reporté hors v1. Elle devra ensuite servir de source de vérité unique pour :

- les schémas de validation ;
- les fixtures de test ;
- le générateur BAN et DIFF ;
- le prompt de passage de relais à l'agent chargé du correctif.
