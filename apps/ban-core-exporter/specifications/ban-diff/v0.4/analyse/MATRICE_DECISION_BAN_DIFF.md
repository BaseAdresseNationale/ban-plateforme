# Matrice de décision FULL et DIFF

## Objet et méthode

Ce document transforme les matériaux fournis en décisions de contrat. Il couvre uniquement la structure, la sémantique et le format des échanges ; les modalités de diffusion, les services et l'outillage de lecture sont hors périmètre à ce stade.

Les statuts employés sont les suivants :

- **Confirmé** : décision de contrat retenue. Ce statut ne certifie pas à lui seul l'implémentation ni la couverture des tests.
- **À intégrer** : attente utilisateur claire, à traduire en règle normative dans la specification.
- **À arbitrer** : information incomplète, contradictoire, ou choix d'architecture encore nécessaire.
- **À exclure** : comportement ou événement hors contrat, dont la non-émission doit être vérifiée.

La [spécification normative v0.4](../specifications/SPECIFICATION_BAN_DIFF_V0.4.md)
fait foi. Les ID sont conservés pour la traçabilité ; certaines décisions initiales
sont précisées par une ligne ultérieure. Les travaux de conformité et les choix
encore ouverts figurent séparément en fin de document.

## Profil de publication

Les exports FULL et DIFF suivent le contrat `ban-standard`. Chaque propriété
porte un équivalent français conseillé, inspiré du Standard Adresse CNIG.
Voir [les correspondances du modèle](CORRESPONDANCES_STANDARD_ADRESSE.md).

## Sources examinées

- `DRAFT # Format BAN.md` : brouillon initial du modèle logique FULL et DIFF.
- Jeu fictif de qualification : 1 district, 16 toponymes et 21 adresses.
- `20260417_Debrief_tests_dintegration_DIFF.docx` : retours d'intégration, notamment DGFiP, Enedis et Altitude Infra.
- `Specification_du_format_differentiel_associe_au_format_BAN_STD.docx` : brouillon de specification DIFF v0.4.
- `Review fichier différentiel fev2026 (1).docx` : revue fonctionnelle du DIFF.
- `review spec diff v0.4.xlsx` : suivi de finalisation et confirmations de conception.

## Décisions et exigences de format

| ID | Sujet | Statut | Règle à retenir | Conséquence pour la specification et le générateur |
| --- | --- | --- | --- | --- |
| D-01 | Support de transport | Confirmé | FULL et DIFF sont des flux **NDJSON** : un objet JSON autonome par ligne. | Définir le schéma de la ligne d'ouverture, des lignes de données et de la ligne de clôture. Ne pas présenter le tableau JSON monolithique comme format de transport. |
| D-02 | Bornes du flux | Confirmé | Tout flux a une première ligne `stream-start` et une dernière `stream-end`. Cette convention s’applique aux FULL et aux DIFF. | Rendre ces deux lignes obligatoires et imposer leur cohérence (version, filtre, format, période, types de données). |
| D-03 | Statistiques de clôture | Confirmé | La clôture fournit les compteurs des lignes réellement émises par type ; en DIFF, `count` est la somme de `created`, `updated`, `disabled`. | Générateur et validateurs contrôlent ces compteurs, y compris pour les sélections vides. Voir D-46. |
| D-04 | Etat de référence | Confirmé | Un DIFF ne s'applique qu'à un export complet, à un instant de référence connu. Le FULL sert à l'initialisation et à la resynchronisation. | Le DIFF doit exposer une période explicite `from` / `to` et la spec doit définir les règles d'application et de reprise. |
| D-05 | Types d'événements | Confirmé | Le DIFF publie `created`, `updated` et `disabled`. | Fixer cette énumération, sans type implicite ni événement non documenté. |
| D-06 | Charge utile d'un événement | Confirmé | `created` contient le seul état après, actif ou désactivé si créé puis désactivé dans la fenêtre ; `updated` contient deux états dans l'ordre **après puis avant** ; `disabled` contient l'état après, désactivé. | La charge publique est `data` dans le flux : 1 état pour `created`/`disabled`, 2 pour `updated`. `datas` est seulement un nom interne SQL. |
| D-07 | Désactivation et statut | Confirmé | `event` décrit l'opération DIFF ; `status` décrit l'état de l'objet. Le FULL ne publie que les objets actifs ; le DIFF peut diffuser un objet au statut `disabled`, y compris sous `created`. La cohérence FULL/DIFF porte sur la vue active, pas sur le registre des traces désactivées. | Définir le nom, les valeurs autorisées et la portée de `status` à partir du standard BAN. |
| D-08 | Autonomie du DIFF | Confirmé | Les communes, toponymes et adresses portent directement le code INSEE courant dans leurs métadonnées métier, dans chaque état exporté. | `meta.insee.cog` est obligatoire. Voir D-44. |
| D-09 | Commune historique | Confirmé | Le modèle exprime séparément l'identifiant BAN historique et le code INSEE historique, lorsque ces informations sont connues. | Champs facultatifs, omis si absents, conformément à D-24 ; les fixtures DIFF comportent un exemple non nul. |
| D-10 | Mouvements administratifs | Confirmé | Fusion, absorption et mutations administratives utilisent les trois événements existants, sans nouveau type d'événement. | Arbitrage résolu par D-25 ; compléter le scénario fictif et les contrôles de références et de reconstruction FULL/DIFF. |
| D-11 | Changements de configuration de commune | À exclure | Les changements techniques de configuration (certificat, logo, etc.) ne doivent pas produire de DIFF métier. | Filtrer ces changements dans le générateur ; ajouter des tests de non-régression. |
| D-12 | Commune supprimée / état inconnu | À exclure | Aucun événement `unknown` ni ligne « commune supprimée » non typée n'est introduit en v0.4. Une désactivation connue reste un événement métier `disabled`. | Arbitrage résolu par D-25. Ne pas exclure les désactivations légitimes ; une suppression physique sans état après n'a pas de nouvelle représentation implicite. |
| D-13 | Identifiants BAN | Confirmé | Les UUID BAN restent les identifiants de référence et servent aux relations entre district, toponyme et adresse. | Conserver les relations explicites et valider leur intégrité dans chaque FULL et DIFF. |
| D-14 | `nodeKey` | Confirmé | `nodeKey` est facultatif et réservé aux usages de développement ou de diagnostic. Il ne constitue pas un identifiant métier et ne doit jamais servir de référence entre objets. | Le schéma l'autorise dans l'enveloppe NDJSON, mais le générateur et les consommateurs doivent fonctionner en son absence. |
| D-15 | Clé d'interopérabilité | Confirmé | Les trois clés nécessaires sont publiées dans `meta`, sous des noms distincts : clé fournie par la BAL, clé calculée par la BAN et identifiant historique d'export CSV. | Définir les trois noms, leur provenance, leur nullabilité et leur stabilité. La publication ne préjuge pas de leur rôle dans le déclenchement d'un `updated`. |
| D-16 | Clé de ciblage | Confirmé | Les clés de ciblage ne font pas partie du contrat public v0.4. | Ne pas les publier dans les objets ni les métadonnées du flux. |
| D-17 | Format de publication | Confirmé | Le service produit les FULL et DIFF au format `ban-standard`. | `meta.format` identifie le format du fichier ; les demandes portent les paramètres de sélection. |
| D-18 | Libellés multilingues | À arbitrer | Tableau multilingue et codes ISO 639-3 sont retenus. Les entrées sans valeur sont omises ; aucun français ou libellé de substitution n'est inventé. | Voir D-33 et la spécification pour les règles acquises. Une politique de déduplication ou une langue de repli reste à décider avant d'ajouter une exigence. |
| D-19 | Position et géométrie | À arbitrer | Point WGS84, ordre longitude/latitude et valeurs techniques de position en anglais sont retenus ; la géométrie de toponyme peut être nulle pour compatibilité historique. | Voir D-32/D-39 pour les règles acquises. Décider si un vocabulaire fermé des positions et une précision chiffrée sont requis ; ne pas les imposer implicitement. |
| D-20 | Période temporelle du DIFF | Confirmé | La période couverte est l'intervalle semi-ouvert `[from, to)`, exprimé en UTC RFC 3339 : `from` est inclus et `to` est exclu. | Formuler explicitement cette règle dans la specification et fournir deux DIFF consécutifs comme exemple sans chevauchement ni trou. |
| D-21 | Version | Confirmé | La version du contrat est `0.4`, portée par `meta.formatVersion` à l'ouverture. | `meta.v` n'est pas un champ public v0.4. La politique de compatibilité des prochaines versions reste à documenter avant diffusion. |
| D-22 | Exemples et tests | Confirmé | Des FULL et DIFF fictifs versionnés doivent illustrer les règles retenues, avec les états avant/après et des compteurs exacts. | Fixtures de base et validation automatique présentes. Compléter les exemples de mouvements administratifs, deux périodes successives et non-émission technique ; statut de décision distinct de la couverture. |
| D-23 | Valeurs de `status` | Confirmé | La v0.4 limite `status` à `active` et `disabled`. Les statuts liés aux signalements relèvent d'une évolution de format. | Énumération fermée ; les validateurs rejettent les autres valeurs. |
| D-24 | Commune historique | Confirmé | Le lien historique et le code INSEE historique sont deux champs distincts : `historicalDistrictID` et `historicalInseeCode`. | Aligner le flux sur cette règle, avec des champs optionnels et un exemple non nul. |
| D-25 | Mutation administrative | Confirmé | Fusion, absorption et changement administratif utilisent seulement `created`, `updated` et `disabled`. Aucun événement `unknown` ou `administrative-change` n'est introduit en v0.4. | Définir l'ordre d'application et publier un scénario complet montrant les effets sur communes, toponymes et adresses. |
| D-26 | Déclenchement par une clé calculée | À exclure | Le recalcul isolé d'une clé BAN ne déclenche pas de `updated`. La clé reste publiée lors d'un changement métier. | Arbitrage résolu par D-27 ; vérifier la non-émission et la conservation de la clé lorsqu'un vrai changement accompagne le recalcul. |
| D-27 | Recalcul technique de clé | Confirmé | Le recalcul isolé d'une clé BAN ne produit pas d'événement `updated`. Les clés restent publiées dans `meta` lors des événements métier. | Exclure ce cas de la détection d'écart et créer une fixture de non-émission. |
| D-28 | Dates d’objet | Confirmé | `updatedAt` est la date de modification ; `integratedAt` est la première intégration explicitement fournie, ou `null` si inconnue. | Aucun repli sur une date de révision BAL ; ne pas assimiler ces champs aux dates de validité CNIG. |
| D-29 | Absence, inconnue et listes | Confirmé | Un champ non applicable est absent. `null` signifie qu'un champ applicable a une valeur explicitement inconnue. Les tableaux présents sont toujours des tableaux, éventuellement vides. | Faire respecter cette convention par les schémas et les fixtures ; interdire les tableaux à `null`. |
| D-30 | Charge utile DIFF | Confirmé | Une ligne DIFF porte une clé `data` toujours sous forme de tableau : un état pour `created` et `disabled`, deux états `[après, avant]` pour `updated`. | Utiliser ce contrat dans le flux et valider strictement la cardinalité selon `event`. |
| D-31 | Ordre du flux DIFF | Confirmé | Pour les créations et mises à jour : districts, puis toponymes, puis adresses. Pour les désactivations : ordre inverse. | Garantir cet ordre dans le générateur afin qu'un consommateur puisse appliquer le flux directement. |
| D-32 | Géométrie v0.4 | Confirmé | Point WGS84 : exactement deux coordonnées `[longitude, latitude]`. La géométrie de toponyme peut valoir `null` par compatibilité historique. | Rejeter les tableaux de 0, 1 ou 3 coordonnées ; les positions d’adresse restent renseignées. |
| D-33 | Libellés | Confirmé | `labels` est un tableau obligatoire, vide autorisé pour une adresse ; non vide pour commune/toponyme. Le premier élément renseigné constitue le libellé de référence, les suivants des traductions ou variantes. | Préserver l'ordre des entrées renseignées, sans traduction ni remplacement automatique. La politique de déduplication reste à arbitrer en D-18. |
| D-34 | Toponymes d'une adresse | Confirmé | `mainToponymID` est obligatoire. `secondaryToponymIDs` est toujours présent et vaut `[]` en l'absence de toponyme secondaire. | Valider l'existence de toutes les références. |
| D-35 | Emplacement des métadonnées | Confirmé | Toutes les métadonnées métier de l'objet, dont INSEE, provenance et interopérabilité, sont dans `data.meta`. L'enveloppe de ligne est réservée au transport. | Normaliser les entrées SQL existantes et placer les codes INSEE requis dans chaque état d'objet DIFF. |
| D-36 | Etat d'activité | Confirmé | `status` décrit l’activité de l’objet. Les objets du FULL ont `status: "active"`. | Ne pas produire de champ d'activité redondant ; valider que le FULL ne contient pas d'objet désactivé. |
| D-37 | Équivalents français conseillés | Confirmé | Chaque propriété porte un « Équivalent conseillé pour un Standard-FR-CNIG », y compris lorsque les noms sont identiques. | Documenter le profil français proposé et les correspondances conceptuelles ou adaptations BAN. |
| D-38 | Certification | Confirmé | La certification d'une adresse est un booléen obligatoire : `certified` dans le flux. | Rejeter une valeur absente, nulle ou hors booléen dans les validateurs. |
| D-39 | Positions d'adresse | Confirmé | `positions` est un tableau non vide. Le premier élément est la position principale ; les suivants sont complémentaires. | Préserver l'ordre et valider la présence d'au moins une position GeoJSON `Point`. |
| D-40 | Codes postaux | Confirmé | `postalCodes` est toujours un tableau de chaînes, éventuellement vide lorsqu'aucun code n'est connu. | Utiliser le même type dans le flux ; ne jamais émettre une chaîne ou `null` à sa place. |
| D-41 | Numéro et suffixe | Confirmé | `number` et `suffix` sont tous deux facultatifs, car une adresse peut ne porter ni numéro ni suffixe. Un numéro présent est un entier ≥ 0. | Omettre le numéro absent. Accepter `0` pour la compatibilité historique, sans le recommander pour les nouvelles données ; une version ultérieure pourra l'interdire. Le suffixe présent reste une chaîne non vide. |
| D-42 | Provenance | Confirmé | `meta.source` est une chaîne unique non vide ; `assemblage` représente une composition de données. | Ne pas produire de tableau de sources. Aucun vocabulaire fermé n'est défini par le schéma actuel ; son éventuelle introduction reste à arbitrer. |
| D-43 | Configuration de district | Confirmé | `config` ne fait pas partie des formats publics FULL et DIFF v0.4. | Ne pas publier cette donnée et vérifier qu'un changement technique seul ne produit pas de DIFF, conformément à D-11. |
| D-44 | Code INSEE courant | Confirmé | `data.meta.insee.cog` est obligatoire sur district, toponyme et adresse. | Valider ce champ dans tous les états d'objet, y compris les états avant/après d'un `updated`. |
| D-45 | Horodatage de flux | Confirmé | Le FULL porte `at` et `generatedAt`. Le DIFF porte `from`, `to` et `generatedAt`. | Définir `at` comme instant de photographie et `generatedAt` comme instant de production. |
| D-46 | Lignes de métadonnées | Confirmé | `stream-start` porte version, type, format, filtres et période. `stream-end` porte `stats` et `generatedAt` seulement. | Ne pas répéter les filtres dans la ligne finale. |
| D-47 | Consolidation dans un DIFF | Confirmé | Un objet ne produit qu'une ligne par fenêtre DIFF : état final puis état antérieur au début de la fenêtre. | Consolider les changements intermédiaires avant sérialisation et vérifier l'unicité d'objet dans les fixtures. |

## Représentation publique et données sources

| Domaine | Modèle logique | Données sources | Représentation publique |
| --- | --- | --- | --- |
| Enveloppe | Document JSON avec tableaux `districts`, `toponyms`, `addresses` | Flux NDJSON : ouverture, enregistrements `{ data, meta, type, nodeKey }`, clôture | Séparer modèle logique et sérialisation NDJSON. |
| Référence de voie | `mainToponymID` / `secondaryToponymIDs` | `mainCommonToponymID` / `secondaryCommonToponymIDs` | Noms publics retenus : `mainToponymID` / `secondaryToponymIDs`. Les noms SQL servent au traitement interne. |
| Toponyme | `positions[]` | `geometry` unique | Géométrie unique `Point` ou `null` pour compatibilité historique ; les positions multiples concernent les adresses. |
| Activité | non définie | `isActive` présent sur chaque objet | Champ public `status` ; `isActive` reste interne. Voir D-07 et D-36. |
| Temporalité | `legalityDate`, `BETA_lastRecordDate` | `updateDate`, `range_validity` | Champs publics `updatedAt` et `integratedAt`, bornes de sélection `at` ou `from` / `to`. |
| Métadonnées INSEE | prévues dans la donnée | portées dans l’enveloppe source | Pour le DIFF, rendre le code INSEE de voie/adresse directement disponible conformément à D-08. |

## Choix encore ouverts, sans modification implicite du contrat

- **D-18** : déduplication des libellés (doublon exact ou langue répétée) et éventuelle langue de repli. Le comportement actuel conserve l'ordre des entrées renseignées, sans remplacement automatique.
- **D-19** : vocabulaire fermé des types de position et précision des coordonnées. Les contraintes acquises de géométrie restent applicables ; aucun arrondi nouveau n'est décidé ici.
- **D-42** : éventuel vocabulaire fermé de provenance ; actuellement une chaîne non vide.
- **D-21** : politique de compatibilité et gestion des prochaines versions avant diffusion.

Ces choix demandent un accord explicite avant de changer les schémas ou le
générateur. Les décisions sur les événements administratifs, clés de ciblage, dates et
format de publication figurent dans les lignes confirmées de la matrice.

## Preuves de conformité et limites

Un statut de décision fermé n'est pas une certification du code. Les contrôles
restent identifiables séparément :

- **D-11/D-26/D-27/D-43** : exclusions de comparaison et tests ciblés de sérialisation ban-standard pour configuration et recalcul isolé de clé, avec ou sans changement d'horodatage ; modifications métier simultanées, états complets et compteurs préservés. Ces contrôles hors base ne démontrent pas une modification du mécanisme SQL de sélection des candidats.
- **D-10/D-20/D-22/D-25** : [scénario administratif versionné](../fixtures/administrative/README.md), trois FULL et deux DIFF contigus ; schémas, cadrage, compteurs et reconstruction de la vue active finale vérifiés par `administrative-contract.test.ts`.
- **D-13/D-31/D-34** : ordre et références actives contrôlés après chaque ligne dans ce scénario ; registre des traces désactivées conservé. Cas négatifs : fenêtres inversées, création en doublon et UUID avant/après différents. Les géométries nulles et numéros absents ou égaux à zéro sont illustrés sans prétendre couvrir toutes les mutations administratives réelles.

Les tests doivent préciser leur portée : schéma de ligne, cohérence du flux,
sérialisation, sélection SQL ou reconstruction côté consommateur. Des fixtures
hors base ne qualifient pas à elles seules l'historisation PostgreSQL ni une
migration administrative réelle.

## Critères de clôture

La spécification normative, déjà rédigée, est la source de vérité du contrat.
La matrice est close lorsque les choix ouverts sont décidés ou explicitement
reportés, et lorsque chaque exigence a une preuve adaptée ou une limite documentée.
Elle doit rester alignée avec les schémas, les fixtures et le générateur ; un
passage mécanique de toutes les lignes à « Confirmé » n'est pas suffisant.
