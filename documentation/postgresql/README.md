# Sauvegarder, restaurer et mettre à niveau PostgreSQL

Guides de sauvegarde, restauration et mise à niveau pour les développeurs et
l'équipe exploitant BAN Platform.

| Besoin | Guide |
| --- | --- |
| Produire une archive custom, vers un fichier ou S3 | [Sauvegarde](sauvegarde.md) |
| Installer une archive sur une nouvelle base locale | [Restauration locale](restauration-locale.md) |
| Vérifier les migrations et fonctions après restauration | [Mise à niveau](mise-a-niveau-apres-restauration.md) |
| Préserver propriétaires, rôles et droits pour une reprise | [Sauvegarde et reprise production](sauvegarde-et-reprise-production.md) |
| Enchaîner les mises à jour, basculer et préparer un retour arrière | [Cycle local](cycle-local.md) |
| Utiliser les scripts et leurs précontrôles | [Outils PostgreSQL](../../scripts/postgresql/README.md) |

Parcours local : **archive vérifiée → restauration dans une nouvelle base →
contrôle de la baseline et migrations Prisma → tests → bascule approuvée**.
Prisma installe la couche SQL d’export ; les outils de sauvegarde/restauration
ne déclenchent ni migration ni bascule.

## Noms utilisés et cycle de vie

La base applicative initiale se nomme **`ban` par défaut** ; adapter ce nom à
l'installation. Les exemples nomment la candidate **`ban_restore`**. Préférer
un suffixe daté, par exemple `ban_restore_20261015`, pour distinguer les générations.
Le script exige un nom cible explicite et refuse toute base déjà présente.

- `CURRENT_DATABASE` : base utilisée par les services, protégée pendant la restauration.
- `SOURCE_DATABASE` : base à sauvegarder, habituellement la base courante.
- `TARGET_DATABASE` : nouvelle candidate, sans valeur par défaut dans le script.

Après validation et bascule, la candidate devient la base courante et la source
habituelle des sauvegardes. Le cycle suivant utilise un autre nom de cible,
sans renommage PostgreSQL.

## Sécurité commune

- Vérifier conteneur, serveur, rôle et base courante avant toute écriture. Les
  outils protègent `CURRENT_DATABASE`, la source, `ban` et les bases système.
- Utiliser une archive de confiance : sa restauration exécute du SQL avec les
  droits du rôle connecté, même dans une base isolée.
- Conserver sources, sauvegardes et journaux jusqu'à validation et décision de
  nettoyage. Les outils ne suppriment aucune base et n'éditent aucun `.env`.
- Garder dumps, données et secrets hors Git, dans un stockage privé à rétention définie.
- Exécuter les exemples en **Bash**, depuis la racine du dépôt, après avoir
  renseigné les paramètres `<...>` et lu les conditions de chaque étape.
  Sous Windows, utiliser WSL (environnement Linux) avec Node.js et Docker CLI
  disponibles dans ce même environnement ; sous Linux/macOS, utiliser un terminal Bash.

## Configuration des outils et de l'application

- [`.env.example`](../../.env.example) : modèle pour les services sur la machine hôte.
- [`.env.docker`](../../.env.docker) : modèle partagé pour le réseau des conteneurs.
- `.env` : fichier personnel ignoré par Git, à conserver localement.

Les identifiants des modèles sont publics et réservés au développement local :
ne pas les réutiliser en production. Ne joindre aux PR ni `.env` personnel,
ni sauvegarde, ni rapport contenant des données ou secrets réels.

Modifier `PG_DB` ne réécrit pas `PG_URI` et `PG_URL` : vérifier leurs base, hôte,
port et identifiants. `schema=ban` désigne le schéma, pas la base. Depuis l'hôte,
utiliser le port publié ; entre conteneurs, le nom du service et son port interne.
Les variables de ces guides ne changent pas la configuration des services.
Les réglages `POSTGRES_*` servent à initialiser un volume neuf.

Vérifier les différences d'identifiants entre `PG_USER`, `PG_URI` et `PG_URL` du
modèle Docker. PgAdmin attend `PGADMIN_DEFAULT_EMAIL`/`PGADMIN_DEFAULT_PASSWORD`
dans le Compose de développement, et `PGADMIN_EMAIL`/`PGADMIN_PASSWORD` dans les
scripts de déploiement : renseigner les variables adaptées à l'outil utilisé.
