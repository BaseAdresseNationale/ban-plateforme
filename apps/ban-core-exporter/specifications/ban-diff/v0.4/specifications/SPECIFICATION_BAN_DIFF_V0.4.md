# Specification normative FULL et DIFF v0.4

## Portée et conventions

Cette specification définit les exports FULL et DIFF au format `ban-standard`. **DOIT** exprime une obligation. Un flux est du NDJSON UTF-8 : un objet JSON par ligne. `exportType: "full"` désigne un FULL et `exportType: "diff"` un DIFF.

- **FULL — export complet** : photographie des objets actifs à l'instant `at`, pour le périmètre sélectionné.
- **DIFF — export différentiel** : changements consolidés entre `from` inclus et `to` exclu : créations, mises à jour et désactivations. Il permet d'actualiser un état de départ compatible.

Les colonnes « Équivalent conseillé pour un Standard-FR-CNIG » proposent des noms de clés pour une représentation française inspirée du Standard Adresse CNIG. Chaque propriété des JSON Schema porte cet équivalent dans sa description, y compris lorsque les noms sont identiques. Les états, événements et valeurs métier suivent les règles BAN.

Les [correspondances avec le Standard Adresse CNIG V1 du 28 octobre 2024](../analyse/CORRESPONDANCES_STANDARD_ADRESSE.md) expliquent les rapprochements conceptuels et les choix de représentation BAN : positions regroupées dans un tableau, certification booléenne, statuts, dates métier et extensions de flux.

`uuid` est un UUID canonique minuscule. `datetime` est RFC 3339 UTC. Un champ non applicable est absent ; `null` signifie « applicable mais inconnu » ; un tableau existant n'est jamais `null`.

## Flux

La première ligne est `{ "meta": { "note": "stream-start", ... } }` et la dernière est `{ "meta": { "note": "stream-end", ... } }`.

| Ouverture | Équivalent conseillé pour un Standard-FR-CNIG | Type | Règle |
| --- | --- | --- | --- |
| `meta.formatVersion` | `metadonnees.versionFormat` | string | `0.4` |
| `meta.exportType` | `metadonnees.typeExport` | string | `full` ou `diff` |
| `meta.format` | `metadonnees.format` | string | `ban-standard` uniquement |
| `meta.request.dataTypes` | `metadonnees.requete.typesDonnees` | string[] | Types sélectionnés |
| `meta.request.departments` | `metadonnees.requete.departements` | string[] | Départements sélectionnés |
| `meta.request.at` | `metadonnees.requete.a` | datetime | obligatoire pour un FULL |
| `meta.request.from`, `meta.request.to` | `metadonnees.requete.de`, `metadonnees.requete.a` | datetime | obligatoires pour un DIFF |
| `meta.request.addressIds`, `toponymIds`, `districtIds` | `metadonnees.requete.idsAdresses`, `idsOdonymes`, `idsCommunes` | uuid[] | facultatifs, appels internes uniquement |

### Demande, contenu et résultat

`request` est obligatoire et décrit la sélection **validée effectivement
utilisée**, valeurs par défaut comprises. Ce n'est ni un inventaire du contenu,
ni une copie brute des paramètres HTTP. Un identifiant demandé peut n'avoir aucun
résultat, notamment en DIFF. Les lignes métier constituent le contenu obtenu ;
les compteurs de clôture décrivent ce contenu, pas le nombre d'identifiants demandés.

Les routes HTTP FULL/DIFF actuelles permettent les départements, types et
dates, mais **n'exposent pas les filtres UUID**. Ces derniers restent disponibles
pour les appels internes à l'exporteur. Leur absence signifie qu'aucun filtre UUID
n'est appliqué ; ne pas y inclure de secrets ou de paramètres de connexion.
Les dates par défaut sont résolues avant l'export et leurs fractions de seconde
sont conservées. Les paramètres de sélection sont regroupés dans `meta.request`.
`meta.format` identifie le format du fichier et vaut `ban-standard` ; le format
est fixé par le service lors de la production du flux.

### Validation et limites de sélection

Chaque liste UUID accepte au maximum **1 000 entrées reçues** ; les trois listes
en acceptent **2 000 au total**, avant déduplication. Les UUID sont validés puis
normalisés en minuscules et dédupliqués. Dépassement ou UUID invalide entraîne
un refus explicite, jamais une troncature. Une liste UUID absente ou `null`
signifie aucun filtre ; une liste UUID fournie vide est refusée pour éviter un
élargissement implicite. Les dates sont validées avec jusqu'à six décimales,
normalisées UTC sans perte de microsecondes ; un DIFF exige `from < to`.

Les types appartiennent aux trois types du contrat (maximum trois entrées reçues),
les départements sont des codes de deux ou trois chiffres, ou `2A` / `2B`, avec
un maximum de 200 entrées reçues ; les doublons sont supprimés. La validité d'un
code ne garantit pas sa présence en base. Pour les appels internes, une liste
de départements vide signifie aucune restriction départementale ; HTTP exige
un département. La validation a lieu avant mise en file et avant exécution de
l'exporteur. Ces limites ne garantissent ni une faible cardinalité du résultat,
ni une durée SQL bornée. Aucun nouveau plafond global en octets n'est introduit.

Un DIFF couvre `[from, to)` : `from` est inclus et `to` exclu. La clôture porte uniquement `generatedAt` (`datetime`) et `stats`. En DIFF, chaque compteur de type porte `count`, `created`, `updated`, `disabled` ; `count` est leur somme.

Une structure installée sans données, un département/UUID absent ou une période
sans événement ne sont pas des erreurs : le flux contient son en-tête et sa
clôture, sans ligne métier, avec tous les compteurs des types sélectionnés à
zéro. L'ordre des clés JSON des statistiques n'a pas de signification. Une
structure/fonction absente ou incompatible doit au contraire faire échouer
l'export ; un artefact partiel sans clôture n'est jamais un succès vide. Une
requête invalide reste une erreur même si elle aurait sélectionné zéro objet.

## Enveloppes

Un FULL porte une ligne `{ "type": "address", "nodeKey": "ADDRESS:::uuid", "data": { ... } }`. `nodeKey` est facultatif, technique et non métier.

Un DIFF porte `{ "event": "updated", "type": "address", "data": [{...}, {...}] }`.

| Clé BAN | Équivalent conseillé pour un Standard-FR-CNIG | Type | Règle |
| --- | --- | --- | --- |
| `event` | `evenement` | string | `created`, `updated`, `disabled` |
| `type` | `type` | string | `district`, `toponym`, `address` ; équivalents français conseillés : `commune`, `odonyme`, `adresse` |
| `data` | `donnees` | object[] | 1 état pour created/disabled ; 2 états `[après, avant]` pour updated |

Un objet apparaît au plus une fois par DIFF. Les modifications intermédiaires sont consolidées : `data[0]` est le dernier état avant `to`; `data[1]` est l'état juste avant `from`. Les créations/mises à jour sont ordonnées district, toponyme, adresse ; les désactivations, adresse, toponyme, district.

### Création et statut final

`event` décrit le changement consolidé ; `status`
décrit l'état final. Un `created` DOIT porter un seul état après, dont le statut
peut être `active` **ou `disabled`**. Par exemple, un objet absent au début,
créé puis désactivé pendant la fenêtre est publié une seule fois comme
`created` avec `status: "disabled"`. Il n'est ni omis ni publié à nouveau
comme `disabled` dans ce même DIFF. Les compteurs le classent uniquement
dans `created`.

Un `disabled` décrit une transition actif → désactivé et porte un seul état
après désactivé. Un `updated` porte deux états, après puis avant. Le statut
n'est pas déduit du seul nom d'événement ; une réactivation peut être une
mise à jour vers un état actif. Un objet désactivé inchangé ne doit pas être
réémis dans la période suivante ; une nouvelle modification peut le faire
réapparaître.

#### Application du DIFF et cohérence avec un FULL

Le FULL ne contient que les objets actifs. Pour les mêmes instant et périmètre,
la cohérence attendue concerne la **vue active** : appliquer le DIFF à l'état
de départ doit retrouver les objets actifs du FULL d'arrivée. Cette règle ne
garantit pas l'égalité d'un registre conservant aussi les objets désactivés.

Le consommateur d'une vue active DOIT examiner le statut final : un
`created` désactivé n'ajoute aucun objet actif. Un consommateur conservant les
traces désactivées peut enregistrer cet UUID et son état ; un FULL seul ne
fournit pas nécessairement ces traces. La non-réutilisation des UUID relève
de BAN, pas de la seule mémoire du consommateur.

Les références sont contrôlées dans le registre métier correspondant :
les références d'un objet actif doivent être résolues dans la vue active ;
une trace désactivée peut référencer un objet également désactivé, absent du
FULL actif. Ne pas rendre la réception d'une trace dépendante de la présence
de tous ses parents dans la seule vue active.

## Champs communs

| Clé BAN | Équivalent conseillé pour un Standard-FR-CNIG | Type | Obligatoire | Règle |
| --- | --- | --- | --- | --- |
| `labels` | `libelles` | object[] | oui | tableau ; vide autorisé pour une adresse, non vide pour commune/toponyme |
| `labels[].value` | `libelles[].valeur` | string | oui | non vide |
| `labels[].isoCode` | `libelles[].codeIso` | string | oui | ISO 639-3 minuscule |
| `status` | `statut` | string | oui | `active` ou `disabled` |
| `updatedAt` | `dateDerniereMiseAJour` | datetime | oui | date de dernière modification métier |
| `integratedAt` | `dateIntegrationBAN` | datetime/null | oui | première intégration BAN explicitement fournie ; `null` si inconnue, aucun repli sur une date de révision BAL |
| `meta.insee.cog` | `metadonnees.insee.code` | string | oui | code INSEE courant |
| `meta.source` | `metadonnees.source` | string | oui | une source ; `assemblage` pour une composition |
| `meta.interop.balProvidedKey` | `metadonnees.interop.cleFournieBAL` | string | non | clé BAL |
| `meta.interop.banComputedKey` | `metadonnees.interop.cleCalculeeBAN` | string | non | clé calculée BAN |
| `meta.interop.legacyCsvId` | `metadonnees.interop.idCsvHistorique` | string | non | identifiant CSV historique |

Toutes les métadonnées métier sont dans l'objet, jamais dans l'enveloppe. Le recalcul isolé d'une clé calculée ne produit pas de DIFF.

### Changements techniques et déclenchement d'un `updated`

La comparaison des états exportés ignore la clé calculée BAN
(`meta.interop.banComputedKey`) et la date
de dernière modification (`updatedAt`). Un changement
de configuration de commune n'est pas publié et ne déclenche pas, à lui seul,
un événement métier, même s'il entraîne une nouvelle date de modification.
Une date modifiée seule n'est donc pas une preuve de changement métier.

Ces exclusions concernent uniquement la décision d'émettre un `updated`.
Les événements `created` et `disabled` ne sont pas supprimés par cette
comparaison. Si un vrai changement accompagne le recalcul ou la configuration,
les deux états complets sont publiés avec leurs dates et clés respectives.
La clé BAL fournie, l'identifiant CSV historique, la provenance, le statut,
les libellés, les références et la géométrie ne sont pas exclus de la comparaison.

Un consommateur DIFF peut conserver une ancienne clé calculée ou date lorsqu'un
changement purement technique a été ignoré. La cohérence avec le FULL porte alors
sur les objets actifs et leur contenu métier, pas sur l'égalité de ces champs
techniques ni sur une égalité octet par octet. Un FULL ou le prochain changement
métier apporte leur valeur courante. La sélection SQL reste temporelle ; cette
règle de non-émission s'applique après conversion, avant les compteurs de clôture.

À la sérialisation, les entrées de libellés dont `value` est absent, `null` ou
une chaîne vide sont omises. Les autres langues et leur
ordre sont conservés, sans traduction automatique ni remplacement par le français.
Le libellé propre d'une adresse est facultatif : si aucun libellé renseigné ne
subsiste, `labels` vaut `[]`. Aucun libellé n'est construit depuis
le nom du toponyme ou le numéro. Chaque entrée présente doit avoir une valeur
non vide et un code de langue valide. Pour une commune ou un toponyme, aucun
libellé renseigné reste une erreur explicite ; l'objet n'est pas ignoré.
Cette règle ne modifie pas les données en base ni les versions historiques.
Elle s'applique aussi aux états avant/après d'un DIFF.

## District / commune

| Clé BAN | Équivalent conseillé pour un Standard-FR-CNIG | Type | Obligatoire | Règle |
| --- | --- | --- | --- | --- |
| `id` | `idCommune` | uuid | oui | identifiant propre du district |
| `historicalDistrictID` | `idCommuneHistorique` | uuid | non | lien BAN historique |
| `historicalInseeCode` | `codeINSEECommuneHistorique` | string | non | code INSEE historique |

`config` est interdit.

## Toponyme / odonyme

| Clé BAN | Équivalent conseillé pour un Standard-FR-CNIG | Type | Obligatoire | Règle |
| --- | --- | --- | --- | --- |
| `id` | `idOdonyme` | uuid | oui | identifiant propre du toponyme |
| `districtID` | `idCommune` | uuid | oui | référence district |
| `geometry` | `geometrie` | Point/null | oui | `null` si la géométrie est absente |
| `geometry.type` | `geometrie.type` | string | si géométrie non nulle | `Point` |
| `geometry.coordinates` | `geometrie.coordonnees` | number[2] | si géométrie non nulle | WGS84 `[longitude, latitude]` |
| `historicalDistrictID` | `idCommuneHistorique` | uuid | non | lien historique |
| `historicalInseeCode` | `codeINSEECommuneHistorique` | string | non | code historique |

L'absence de géométrie d'un toponyme est acceptée pour assurer la compatibilité
avec les données historiques ; elle est représentée par `geometry: null`, sans omettre le champ. Ce n'est pas une recommandation pour
les nouvelles données. L'export conserve l'objet sans fabriquer de coordonnées.
Une géométrie renseignée DOIT être un `Point` WGS84 valide. Cette tolérance
s'applique aux FULL et à tous les états d'un DIFF, mais pas aux positions d'adresse.

## Adresse

| Clé BAN | Équivalent conseillé pour un Standard-FR-CNIG | Type | Obligatoire | Règle |
| --- | --- | --- | --- | --- |
| `id` | `idAdresse` | uuid | oui | identifiant propre de l'adresse |
| `districtID` | `idCommune` | uuid | oui | référence district |
| `mainToponymID` | `idOdonyme` | uuid | oui | référence toponyme principal |
| `secondaryToponymIDs` | `idsOdonymesComplementaires` | uuid[] | oui | tableau, vide si aucun |
| `number` | `numero` | integer | non | supérieur ou égal à `0` ; voir la note de compatibilité ci-dessous |
| `suffix` | `indiceRepetition` | string | non | non vide |
| `certified` | `certification` | boolean | oui | certification |
| `positions` | `positions` | object[] | oui | non vide ; premier élément principal |
| `positions[].type` | `positions[].type` | string | oui | vocabulaire BAN anglais, ex. `entrance` |
| `positions[].geometry.type` | `positions[].geometrie.type` | string | oui | `Point` |
| `positions[].geometry.coordinates` | `positions[].geometrie.coordonnees` | number[2] | oui | WGS84 `[longitude, latitude]` |
| `postalCodes` | `codesPostaux` | string[] | oui | tableau, vide si inconnu |
| `historicalDistrictID` | `idCommuneHistorique` | uuid | non | lien historique |
| `historicalInseeCode` | `codeINSEECommuneHistorique` | string | non | code historique |

Le numéro d'adresse est facultatif : une adresse sans numéro omet `number`, sans lui substituer `0` ou `null`. Lorsqu'il est présent, ce champ
DOIT être un entier supérieur ou égal à `0` ; les nombres négatifs sont interdits.
La valeur `0` est acceptée uniquement pour la compatibilité avec les données
historiques et ne devrait pas être fournie dans de nouvelles données. Elle
pourra être interdite dans une version ultérieure ; aucune interdiction n'est
en vigueur en v0.4. Ces règles s'appliquent aux FULL et à tous les états d'un DIFF.

## Contraintes et fixtures

Les références suivent les règles de vue active et de traces désactivées ci-dessus. Un FULL ne contient que `active`; un `created` porte `active` ou `disabled`, et un événement `disabled` porte `disabled`. Les clés de ciblage et les changements de configuration sont interdits. Une fusion/absorption est décomposée en événements existants.

La livraison v0.4 DOIT fournir et valider : un FULL fictif, les trois événements, deux DIFF consécutifs, une fusion, une commune historique, une adresse sans numéro/suffixe, un toponyme secondaire et un recalcul de clé sans événement.

Le [scénario administratif versionné](../fixtures/administrative/README.md)
illustre ces cas avec trois FULL et deux DIFF successifs.
Les tests de contrat reconstruisent la vue active finale et vérifient références,
ordre, états et compteurs. Il s'agit d'une qualification hors base de la
sérialisation et de l'application du flux, pas d'une validation d'une mutation
administrative réelle ou des fonctions SQL d'historisation.
