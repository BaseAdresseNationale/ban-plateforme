# RabbitMQ

- Centraliser noms, routage, topologies et types ; préserver la compatibilité producteurs/consommateurs.
- Respecter les dépendances entre traitements ; l'ordre HTTP ne garantit pas l'ordre d'achèvement.
- Distinguer session de publication, confirmation broker, ACK et réussite métier ; un simple await ne les démontre pas.
- Tester erreurs, messages non routables, reprises et doublons. Vérifier le raccord réel des retry/DLQ et l'idempotence ; aucune garantie « exactement une fois » sans mécanisme démontré.
- Aucun démarrage broker à l'import ; tests simulés par défaut, intégrations sur instance/vhost et files dédiés.

Références : [topologie](../../RABBITMQ.md), [commandes](package.json).
