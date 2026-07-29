# Topologie RabbitMQ

Ce document décrit la topologie RabbitMQ/Rascal utilisée par BAN Platform.

La configuration d’exécution est volontairement séparée en deux niveaux :

- `@ban/rabbitmq` expose les primitives de messagerie partagées ;
- chaque microservice conserve sa propre configuration Rascal locale.

Le package `@ban/rabbitmq` n’est pas un framework RabbitMQ. Il ne démarre pas les consumers, ne masque pas `broker.publish()` ou `broker.subscribe()`, ne classe pas automatiquement les erreurs métier et ne charge pas toutes les queues dans toutes les applications.

## RabbitMQ en bref

RabbitMQ est un broker de messages : les services ne s’appellent pas directement, ils publient des messages dans RabbitMQ et d’autres services les consomment plus tard.

```text
service producteur
  publie un message avec une routing key
          │
          ▼
exchange RabbitMQ
  route le message selon les bindings
          │
          ▼
queue RabbitMQ
  stocke le message jusqu’à consommation
          │
          ▼
service consommateur
  traite le message puis ack/nack
```

Les notions principales sont :

- `exchange` : point d’entrée où un service publie un message ;
- `routing key` : clé utilisée pour décrire le message ou l’étape du pipeline ;
- `binding` : règle qui relie un exchange à une queue pour certaines routing keys ;
- `queue` : file d’attente persistante consommée par un service ;
- `subscription` : configuration Rascal qui permet à un service de consommer une queue ;
- `publication` : configuration Rascal qui permet à un service de publier vers un exchange.

Dans BAN Platform, chaque microservice déclare localement ce qu’il publie et consomme, mais partage les mêmes noms d’exchanges, conventions de queues et routing keys via `@ban/rabbitmq`.

## Package partagé

`@ban/rabbitmq` centralise les éléments stables partagés par les services :

- les noms d’exchanges via `rabbitExchanges` ;
- les déclarations d’exchanges via `exchangesConfig` ;
- les conventions de nommage des queues via `rabbitQueues` ;
- les routing keys via `routingKeys` ;
- la configuration de connexion via `connectionConfig` ;
- les options communes de durabilité et de publication ;
- les primitives de retry et de dead-letter ;
- les types Rascal partagés ;
- les classes d’erreurs de message.

Les microservices importent ces primitives et assemblent leur configuration Rascal locale avec des objets TypeScript explicites et de simples spreads.

## Exchanges

Les exchanges partagés sont :

| Clé | Exchange | Type | Rôle actuel |
| --- | --- | --- | --- |
| `commands` | `ban.commands` | `topic` | Réservé aux commandes |
| `pipeline` | `ban.pipeline` | `topic` | Pipeline de traitement BAL actuel |
| `events` | `ban.events` | `topic` | Réservé aux événements métier |
| `retry` | `ban.retry` | `topic` | Réservé au routage des retry |
| `deadLetter` | `ban.dead-letter` | `topic` | Réservé au routage dead-letter |

Les microservices utilisent actuellement `ban.pipeline`.

## Queues

Les queues de service suivent la convention `ban.<service>` :

| Service | Queue |
| --- | --- |
| API vers parser | `ban.parser` |
| Parser | `ban.parser` |
| Orchestrator | `ban.orchestrator` |
| Beautifier | `ban.beautifier` |
| Target key | `ban.target-key` |
| Old district | `ban.old-district` |
| Merger | `ban.merger` |
| Writer | `ban.writer` |

Les conventions de queues de retry et de dead-letter sont déjà exposées via `rabbitQueues.retry(service)` et `rabbitQueues.deadLetter(service)`, mais les services ne les utilisent pas encore.

## Routing keys

Le pipeline BAL actuel utilise les routing keys suivantes :

| Routing key | Signification |
| --- | --- |
| `bal.uploaded` | Une BAL a été soumise à la plateforme |
| `bal.parsed` | La BAL a été parsée en lignes |
| `bal.enrich` | Les lignes parsées doivent être traitées par les enrichisseurs |
| `bal.enriched.beautifier` | Résultat d’enrichissement du beautifier |
| `bal.enriched.target-key` | Résultat d’enrichissement des clés cibles |
| `bal.enriched.old-district` | Résultat d’enrichissement des anciennes communes |
| `bal.enriched.*` | Binding du merger pour tous les résultats d’enrichissement |
| `bal.ready` | La BAL fusionnée est prête à être écrite |

Le préfixe `bal.*` est conservé pour les routing keys, car il décrit le pipeline métier. Le namespace d’infrastructure RabbitMQ est porté par les exchanges et queues `ban.*`.

## Flux actuel

```text
ban-core-api
  publie bal.uploaded -> ban.pipeline

bal-parser
  queue : ban.parser
  consomme bal.uploaded
  publie bal.parsed -> ban.pipeline

orchestrator
  queue : ban.orchestrator
  consomme bal.parsed
  publie bal.enrich -> ban.pipeline

beautifier
  queue : ban.beautifier
  consomme bal.enrich
  publie bal.enriched.beautifier -> ban.pipeline

target-key
  queue : ban.target-key
  consomme bal.enrich
  publie bal.enriched.target-key -> ban.pipeline

old-district
  queue : ban.old-district
  consomme bal.enrich
  publie bal.enriched.old-district -> ban.pipeline

merger
  queue : ban.merger
  consomme bal.enriched.*
  publie bal.ready -> ban.pipeline

ban-core-writer
  queue : ban.writer
  consomme bal.ready
```

## Responsabilité locale des services

Chaque service conserve sa configuration Rascal locale dans `src/rabbitmq.config.ts`.

Cette configuration locale porte :

- le nom de la queue du service ;
- les bindings ;
- les publications ;
- les subscriptions ;
- le `prefetch` ;
- la future stratégie de recovery ;
- les futures queues de retry/dead-letter lorsque le service en aura besoin.

Ce découpage garde chaque service lisible tout en évitant la duplication des paramètres de connexion, des exchanges, des conventions de queues et des routing keys.

## État du retry et de la dead-letter

`@ban/rabbitmq` expose déjà les primitives nécessaires au retry et à la dead-letter :

- `rabbitExchanges.retry` ;
- `rabbitExchanges.deadLetter` ;
- `retryPolicy` ;
- `retryQueueOptions` ;
- `deadLetterQueueOptions` ;
- `RetryableMessageError` ;
- `FatalMessageError`.

Les services n’implémentent pas encore le flux retry/DLQ. Lorsqu’il sera ajouté, les queues concrètes, bindings, subscriptions, publications et la classification des erreurs devront rester locaux à chaque service.

## Conventions Rascal

Les publications et subscriptions doivent être déclarées dans le vhost du service :

```ts
export const rabbitmqConfig = {
  vhosts: {
    '/': {
      connection: connectionConfig,
      exchanges: {
        [rabbitExchanges.pipeline]: exchangesConfig.pipeline,
      },
      queues: {
        [queueName]: {
          assert: true,
          options: queueOptions,
        },
      },
      bindings,
      publications,
      subscriptions,
    },
  },
};
```

Cette convention évite de dépendre des valeurs implicites de Rascal au niveau racine et garantit que les publications résolvent correctement leur vhost.

## Notes de migration

Le projet utilisait auparavant :

- l’exchange `bal.events` ;
- des queues nommées `<service>.in`.

La topologie actuelle utilise :

- l’exchange `ban.pipeline` ;
- des queues nommées `ban.<service>`.

Si une instance RabbitMQ locale contient encore les anciennes queues, elles peuvent rester présentes sans être consommées. Les services actifs déclarent et consomment désormais la topologie `ban.*`.
