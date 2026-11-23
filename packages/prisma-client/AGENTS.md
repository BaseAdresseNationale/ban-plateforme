# PostgreSQL / Prisma

- Réutiliser pool, client et transactions existants ; aucune connexion globale supplémentaire par commodité.
- Migrations versionnées immuables : ajouter une migration et préserver empreintes, ordre, triggers, historiques, contraintes, fonctions et indexes.
- Ne pas régénérer la baseline, modifier le registre, reset ou resolve pour masquer un écart ; le schéma Prisma ne décrit pas tous les objets SQL.
- Vérifier `PG_URL` : changer `PG_DB` ne change pas cette destination. Générer le client n'autorise ni migration ni connexion métier.
- Qualifier migrations et garanties SQL sur une base jetable dédiée, avec identité vérifiée ; les procédures manuelles ne garantissent pas cet isolement.
- La suite ordinaire peut générer/construire le client, sans connexion à une base.

Références : [migrations](migration.md), [tests PostgreSQL](tests/README.md), [commandes](package.json).
