# Sauvegarder, restaurer et mettre à niveau PostgreSQL

Ces guides s'adressent aux développeurs et à l'équipe exploitant BAN Platform.
Ils distinguent la sauvegarde, la restauration et l'adaptation d'une base à une
version du code : ces opérations ont des objectifs et des autorisations distincts.

| Besoin | Guide |
| --- | --- |
| Produire une archive custom, vers un fichier ou S3 | [Sauvegarde](sauvegarde.md) |
| Installer une archive sur une nouvelle base locale | [Restauration locale](restauration-locale.md) |
| Vérifier les migrations et fonctions après restauration | [Mise à niveau](mise-a-niveau-apres-restauration.md) |
| Préserver propriétaires, rôles et droits pour une reprise | [Sauvegarde et reprise production](sauvegarde-et-reprise-production.md) |

Le parcours local est : **archive vérifiée → base neuve isolée → restauration
contrôlée → audit de compatibilité → éventuelle mise à niveau → tests → choix
explicite de la base utilisée par l'application**. Une restauration terminée
ne suffit pas, à elle seule, à garantir la compatibilité applicative.

## Sécurité commune

- Ne jamais restaurer dans une base applicative en service. Les exemples locaux
  protègent notamment `ban` et `ban_restore_validation` ; ajouter les noms propres
  à votre installation à cette liste si nécessaire.
- Vérifier conteneur, serveur, base et rôle avant toute écriture. Une variable
  shell de documentation ne modifie pas automatiquement les fichiers `.env`.
- Auditer une cible existante puis choisir une nouvelle base : ces procédures
  ne suppriment, ne vident et ne réinitialisent aucune base existante.
- Utiliser une archive de confiance. Restaurer un dump exécute du code SQL ;
  une base isolée n'empêche pas un dump malveillant d'exploiter les droits du rôle.
- Conserver source, journaux et bases intermédiaires jusqu'à validation et
  décision de nettoyage. Prévoir chiffrement, accès restreint et rétention.
- Ne jamais committer dumps, exports de rôles, secrets ou données réelles.
  Les fichiers de travail restent dans un stockage local ignoré ou dédié.
- Les commandes sont écrites pour **Bash**, à lancer depuis la racine du dépôt.
  Les paramètres entre `<...>` doivent être renseignés ; ne pas exécuter les
  blocs sans avoir lu leurs conditions et vérifié la cible.

## Configuration des outils et de l'application

Les variables des guides sont propres à l'opération (`SOURCE_DATABASE`,
`TARGET_DATABASE`, etc.). Elles permettent de ne pas détourner les variables de
connexion habituelles des services pour restaurer une autre base.

- [`.env.example`](../../.env.example) : modèle pour les services sur la machine hôte.
- [`.env.docker`](../../.env.docker) : modèle partagé pour le réseau des conteneurs.
- `.env` : fichier personnel ignoré par Git, à conserver localement.

Les URL `PG_URI` et `PG_URL` sont explicites ; modifier `PG_DB` ne les réécrit pas.
Vérifier également hôte, port, utilisateur et mot de passe. Le chemin de l'URL
désigne la base ; `schema=ban`, lorsqu'il est utilisé, désigne le schéma, pas la
base. Depuis l'hôte, utiliser le port publié ; entre conteneurs, le nom du service
et son port interne. Les réglages `POSTGRES_*` initialisent un volume PostgreSQL
neuf : ils ne renomment ni ne recréent les bases d'un volume déjà initialisé.

Les valeurs des modèles sont des exemples de développement. Leur réorganisation
ne corrige pas les incohérences préexistantes : vérifier notamment les identifiants
différents entre `PG_USER`, `PG_URI` et `PG_URL` dans le modèle Docker. Pour PgAdmin,
le Compose de développement attend `PGADMIN_DEFAULT_EMAIL` et `PGADMIN_DEFAULT_PASSWORD`,
tandis que les scripts de déploiement utilisent `PGADMIN_EMAIL` et `PGADMIN_PASSWORD` ; renseigner les
variables attendues localement avant de lancer l'outil concerné.

Après validation d'une base restaurée, ajuster la configuration personnelle et
redémarrer explicitement les seuls services concernés. Cette bascule, ainsi que
la suppression d'une ancienne base, reste une décision séparée.
