# Écriture BAN

- Vérifier existence et activité des parents à la persistance, avec des garanties transactionnelles adaptées à la concurrence.
- Avant désactivation d'un toponyme, vérifier ses références principales et secondaires par des adresses actives.
- Préserver les transferts légitimes ; aucune égalité universelle de commune entre objets liés.
- Ne pas utiliser les fonctions de recovery pour une nouvelle écriture métier.
- Tester erreurs partielles PostgreSQL/Mongo, reprises et doublons ; ni ACK ni succès pour une écriture échouée/incomplète. Un UUID stable ne garantit pas l'idempotence.
- Préserver la cohérence des lectures pendant la publication Mongo. Ne pas substituer une date technique à une date métier.
- `test:prisma` charge un `.env` et vise une vraie base : ne pas le traiter comme un test unitaire ni le lancer avec une configuration personnelle/partagée.

Flux et commandes : [entrée du writer](src/index.ts), [package.json](package.json).
