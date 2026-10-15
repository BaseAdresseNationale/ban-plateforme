# Outils PostgreSQL locaux

Sauvegarder, restaurer dans une **nouvelle base** et contrôler l'inventaire.
Prérequis : Node.js 24+, Bash, Docker CLI et conteneur Linux PostgreSQL démarré.
Vérifier le contexte Docker local, les clients/extensions et l'authentification
du rôle dans le conteneur. Il doit pouvoir lire les paramètres et tailles,
notamment `data_directory`, et disposer des droits nécessaires à l'opération.

## Configuration et sécurité

| Paramètre | Rôle / valeur par défaut |
| --- | --- |
| `--container` / `POSTGRES_CONTAINER` | Conteneur PostgreSQL, `ban_postgres` |
| `--username` / `PG_USERNAME` | Rôle, `ban_user` |
| `--current` / `CURRENT_DATABASE` | Base applicative protégée, initialement `ban` |
| `--source` | Base à sauvegarder ou référence de taille, par défaut la base courante |
| `--target` | Obligatoire pour restore et check ; aucun nom par défaut |
| `--archive` | Fichier custom, chemin absolu **dans le conteneur** |
| `--report-directory` | Dossier sur l'hôte, `working/postgresql` par défaut |

Socket local au conteneur : `/var/run/postgresql`, port 5432 **par défaut**,
configurables par `--socket-directory` et `--port`. Ce ciblage explicite évite
un serveur désigné par `PGHOST`. Bases et rôles : identifiants SQL ASCII simples.

- `--dry-run` : lectures et bilan uniquement ; aucun fichier ni base créé.
- Par défaut, backup et restore demandent une phrase avec le nom concerné.
  `--yes` / `-y` accepte la confirmation, sans masquer le bilan ni lever les protections.
- Restore refuse base courante, source, `ban`, bases système et cible existante.
  Il revérifie cible, archive et espace après confirmation, puis crée via `postgres`.
- Aucun chargement de `.env`, mot de passe en argument, nettoyage, migration ou
  bascule. En cas d'échec, conserver la candidate partielle et les journaux.

## 1. Sauvegarder

`/backups` doit être un montage persistant accessible en écriture et le fichier
absent. Une réservation `noclobber` protège aussi contre un écrasement concurrent.

```sh
bash scripts/postgresql/backup.sh --current ban --source ban \
  --archive /backups/ban-20261015.dump --dry-run
# Après examen : relancer sans --dry-run, confirmer « SAUVEGARDER ban ».
```

Archive custom sans ACL ; rapport avec taille de référence, inventaire et SHA-256.
Tester sa restauration isolée. Pour S3 ou les droits de production, voir les
[guides PostgreSQL](../../documentation/postgresql/README.md).

## 2. Restaurer

```sh
bash scripts/postgresql/restore.sh --current ban --source ban \
  --target ban_restore --archive /backups/ban-20261015.dump --dry-run
# Après examen : relancer sans --dry-run, confirmer « RESTAURER ban_restore ».
```

Ajouter `--sha256 <empreinte-attendue>` obtenue par un canal de confiance.
Précontrôles : archive custom lisible, version majeure, PostGIS/btree_gist si
demandés. Vérifier aussi la provenance du SQL et les versions d'extensions.

Options : `--no-owner --no-acl --no-tablespaces --exit-on-error`, deux jobs par
défaut, aucun `--clean`/`--create`. Les objets appartiennent au rôle de restauration,
dans le stockage par défaut de la candidate. Ce profil est local.
Suivre le journal privé indiqué avec `tail -f`. Après interruption du client
Docker, vérifier les sessions serveur avant de réessayer : elles peuvent continuer.

### Personnaliser les ressources

```sh
bash scripts/postgresql/restore.sh --current ban --target ban_restore \
  --archive /backups/ban-20261015.dump --estimated-database-gb 100 \
  --overhead-percent 100 --reserve-gb 5 \
  --jobs 2 --maintenance-mb 256 --work-mb 16 --dry-run
```

1 Go = 1 000 000 000 octets ; les `MB` PostgreSQL sont binaires. Voir
l'[impact disque/mémoire](../../documentation/postgresql/cycle-local.md), notamment
les limites Docker Desktop. Surveiller l'espace pendant le chargement, même avec `-y`.

## 3. Contrôler et poursuivre le cycle

```sh
bash scripts/postgresql/check.sh --current ban --target ban_restore
# Option lente, avec une limite adaptée à chaque requête :
bash scripts/postgresql/check.sh --current ban --target ban_restore \
  --counts --query-timeout-seconds 600
```

Lecture seule ; `report.json` inventorie schémas/extensions, tables/tailles,
contraintes/exclusions, indexes/GiST, triggers, `tstzrange`, fonctions/propriétaires/ACL,
séquences et registres Prisma. Comptages estimés par défaut ; `--counts` compte
exactement les huit tables BAN principales présentes et peut être coûteux.

Table/extension attendue absente, index invalide/non prêt, contrainte non validée
ou trigger désactivé : signalement et code non nul, sans correction automatique.
Comparer à la source et vérifier séparément fonctions, droits et migrations.
Les rapports contiennent des informations sensibles : les garder privés et hors Git.

L'[audit de mise à niveau](../../documentation/postgresql/mise-a-niveau-apres-restauration.md)
et les tests métier précèdent la [bascule manuelle](../../documentation/postgresql/cycle-local.md).
Après bascule, actualiser `--current` et choisir une nouvelle cible au cycle suivant.

## Tests des outils

```sh
node --test scripts/postgresql/postgresql.test.mjs
bash scripts/postgresql/restore.sh --help
```

Tests avec Docker/PostgreSQL simulés. Une répétition réelle sur cible isolée
reste nécessaire après relecture.
