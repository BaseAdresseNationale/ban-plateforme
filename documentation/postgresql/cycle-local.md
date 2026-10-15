# Renouveler une base locale : ressources, bascule et retour arrière

## 1. Identifier la base courante et préparer la candidate

`ban` est le nom initial par défaut. Vérifier la base réellement utilisée par
les services et renseigner `CURRENT_DATABASE`. La source à sauvegarder est
`SOURCE_DATABASE` ; la candidate est `TARGET_DATABASE`.

Les exemples utilisent `ban_restore`. Préférer un nom daté, tel que
`ban_restore_20261015` : la cible est obligatoire dans le script, sans valeur
par défaut. Une cible existante est refusée, jamais écrasée.

## 2. Estimer l'impact sur le disque et la mémoire

Au pic, cohabitent les bases conservées, la candidate avec ses index, les
archives, les fichiers temporaires et les journaux PostgreSQL (WAL). Le script
compare le libre au besoin **supplémentaire**, sans recompter les objets présents.

La taille de référence comprend **données et index**. Par défaut, elle provient
de `--source` (la base courante si cette option est omise). L'option
`--estimated-database-gb` la remplace : à utiliser si l'archive diffère de cette
base. Le poids compressé du dump ne prédit pas la taille restaurée.

- **Restauration** : référence + marge temporaires/WAL (100 % par défaut)
  + réserve (5 Go par défaut). Réglages : `--overhead-percent`, `--reserve-gb`.
- **Sauvegarde** : 120 % de la référence + réserve (5 Go par défaut).
  Le coefficient de 120 % est fixe ; il ne prédit pas le taux de compression.

Exemple : 100 Go de référence → **205 Go libres requis** pour restaurer avec
les réglages par défaut. Ce seuil est une estimation prudente, pas le poids final
de la base ni une garantie PostgreSQL. Le script bloque sous le seuil retenu.

Un disque commun aux données et WAL n'est compté qu'une fois. Sur deux volumes,
le script exige prudemment l'espace estimé complet sur chacun. Les objets et
temporaires sont restaurés dans le stockage par défaut de la candidate
(`--no-tablespaces`, `temp_tablespaces` vide).

### Particularité Docker Desktop

Le libre dans la VM et celui du Mac **ne s'additionnent pas**. Les scripts
affichent volumes, montages et espace hôte accessible. Vérifier aussi l'image
disque dans **Docker Desktop > Settings > Resources** et le disque hôte qui
l'héberge : le plafond physique des volumes nommés n'est pas déduit automatiquement.
Un précontrôle réussi ne garantit donc pas la place nécessaire sur le Mac.

### Mémoire et activité concurrente

Deux bases partagent les caches d'une même instance ; leur coexistence ne double
pas `shared_buffers`. Les outils affichent les mesures Docker disponibles et les
réglages de restauration : **2 jobs, 256MB de maintenance et 16MB de work par défaut**.
Le calcul jobs × (maintenance + work) n'est pas un plafond RAM : opérations,
workers, caches et services concurrents s'ajoutent. Adapter la consommation à la
mémoire réellement disponible ; les réglages sont limités aux sessions de restauration.
Surveiller aussi le disque : activité, slots de réplication ou archivage bloqué
peuvent accroître les WAL après les précontrôles.

## 3. Contrôler puis autoriser la bascule

Conserver les journaux et comparer source/candidate : données et historiques,
contraintes/GiST, fonctions, droits et migrations. Suivre l'[audit de mise à niveau](mise-a-niveau-apres-restauration.md)
puis les tests applicatifs ; `check.sh` fournit seulement l'inventaire technique.
Faire approuver la bascule et la fenêtre de retour arrière, et garder l'ancienne
configuration en privé. Si la base reçoit des écritures, arrêter les écrivains
et prévoir la reprise des changements postérieurs au dump.

## 4. Basculer manuellement

1. Arrêter les services applicatifs concernés, sans supprimer de volume Docker.
2. Dans la configuration personnelle, mettre à jour `PG_DB`, la base des URL
   `PG_URI` et `PG_URL`, ainsi que toute surcharge effectivement consommée.
   Conserver `schema=ban` si utilisé : c'est le schéma, pas le nom de base.
3. Redémarrer les services ; vérifier leurs connexions et réaliser des tests
   métier en lecture et, si autorisé, en écriture sur la nouvelle base.
4. Garder l'ancienne base et ses sauvegardes pendant la fenêtre convenue.

Garder les noms personnels de candidates hors des modèles `.env` partagés.

## 5. Recommencer ou revenir en arrière

Si la candidate s'appelle `ban_restore`, elle devient après bascule
`CURRENT_DATABASE` et la `SOURCE_DATABASE` habituelle. Choisir par exemple
`ban_restore_20261101` comme prochaine cible. Renseigner ces noms à chaque cycle :
les outils ne lisent pas les `.env`. Ils n'appliquent ni migration ni bascule.

Pour revenir en arrière, reconfigurer les services vers l'ancienne base,
redémarrer et contrôler. **Réconcilier les écritures faites sur la nouvelle base** :
elles ne sont pas retransférées automatiquement.

Avant le cycle suivant, décider des anciennes générations à conserver : trois
bases peuvent sinon cohabiter. Nettoyage séparé après validation des sauvegardes,
sans suppression automatique.

Références : [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html),
[mémoire PostgreSQL](https://www.postgresql.org/docs/17/runtime-config-resource.html),
[stockage Docker Desktop pour Mac](https://docs.docker.com/desktop/troubleshoot-and-support/faqs/macfaqs/).
