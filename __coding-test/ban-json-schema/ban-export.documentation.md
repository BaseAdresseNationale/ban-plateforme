# Export BAN – Documentation

Ce document accompagne le **JSON Schema d’export BAN** et les **fichiers d’exemples** fournis. Il présente le format, les règles structurantes et les exemples associés à l’export BAN.

---

## 1. Objectif de l’export BAN

Un export BAN représente **l’état structuré des adresses d’un territoire** à un instant donné.

Il est composé de trois ensembles cohérents :

- **Communes** : les entités administratives de référence
- **Odonymes** : les voies, places, lieux-dits (supports de numérotation)
- **Adresses** : les points d’adressage concrets (numéro, position géographique, métadonnées)

Le format est **strictement validé** par un JSON Schema afin de garantir :

- l’interopérabilité,
- la qualité des données,
- la stabilité contractuelle entre producteurs et consommateurs.

---

## 2. Structure générale d’un fichier d’export

Un fichier d’export BAN est un objet JSON avec trois champs principaux :

- `date` : date/heure de génération de l’export
- `status` : statut global (`success` ou `error`)
- `response` : contenu métier
