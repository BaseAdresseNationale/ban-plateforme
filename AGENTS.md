# Consignes communes

## Livraison

- PR : fonctionnalité utilisée, tests et documentation ; nommer le composant et son rôle, suivre le [modèle](.github/pull_request_template.md), sections utiles seulement, accessibles aux débutants. Justifier les adaptations entre services ; séparer les nettoyages indépendants.
- PR assistée par IA : première ligne italique, outil/éditeur et modèles/versions réellement utilisés, précédents conservés. Si inconnus, demander à l’utilisateur sans bloquer le travail ; à défaut « non précisé », jamais deviner.
- Commits atomiques avec tests/documentation, vérifiés sur leur propre contenu : `type(périmètre): sujet` en français, identifiant de lot conservé ; ne pas harmoniser rétroactivement les messages.
- Logique métier dans son service ; partage uniquement pour des consommateurs identifiés.
- Respecter la base et les autres chantiers ; ne pas modifier un autre dépôt ni réécrire une autre branche sans instruction.
- Faire valider les arbitrages métier/architecture ; poursuivre les parties indépendantes autorisées.
- Push, PR, fusion, déploiement et réécriture publiée : accord explicite pour chacun ; réécriture sur la seule branche autorisée, avec `--force-with-lease`.

## Code et vérifications

- pnpm, ESM ; versions requises dans les manifestes (`engines`, `packageManager`, dépendances) et lockfile. Vérifier API/syntaxes et documentation correspondantes ; aucune mise à niveau implicite.
- Style Biome dès l'écriture : deux espaces, guillemets simples, LF, 100 caractères, points-virgules si nécessaires ; `const` préféré, pas de `var`, égalité stricte, aucun import/variable inutilisé, éviter `any`.
- Imports : Node → externes → `@ban/*` → locaux, groupes séparés et tri lexicographique. Conserver l'ordre des initialisations et `.js` NodeNext ; utiliser `import type` et `node:`.
- Suivre la configuration qualité et `CONTRIBUTING.md` s'il existe ; installation/migration Biome, changements d'outillage et formatage global restent des lots distincts.
- Avant changement fonctionnel, relever la référence ; vérifier comportements/régressions ciblés. Rapporter commandes, versions utilisées, résultats, échecs préexistants et contrôles non réalisés sans masquer les diagnostics.
- Un test homonyme par cible, scénarios regroupés ; justifier les tests transversaux. Ne retirer aucune assertion ni désactiver de test pour obtenir du vert.
- Unités sans services ni connexion/écoute réseau à l'import ; intégrations explicites. Documentation seule : pas de suite applicative.

## Environnement et documentation

- Un worktree n'isole pas les services : données fictives, ressources jetables dédiées, ports loopback libres ; aucun `.env` personnel, base existante/restaurée/de production ou worker partagé.
- Vérifier destination/identité avant migration, seed ou nettoyage ; nettoyer uniquement les ressources créées pour la tâche. Ne pas modifier services, ports ou volumes existants sans instruction, ni lancer les scripts globaux par défaut.
- Aucun secret, UUID métier réel, donnée personnelle ou fichier de production dans les fixtures, commits ou livrables ; logs sans identifiants/URI de connexion ni messages complets.
- Aucune réparation, réaffectation ou réactivation silencieuse de données historiques.
- OpenAPI : contrats HTTP ; README : rôle/configuration/procédures ; modèles de configuration sans secrets. Ne pas dupliquer dans les consignes locales.
- Notes dans `working/` ignoré ; décisions durables, contrats et procédures versionnés auprès du composant.

Références et commandes : [projet](README.md), [RabbitMQ](RABBITMQ.md), [PostgreSQL](documentation/postgresql/README.md), manifests concernés.
