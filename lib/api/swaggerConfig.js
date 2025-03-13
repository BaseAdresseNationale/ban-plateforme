/* eslint-disable unicorn/filename-case */
/* eslint-disable camelcase */
import swaggerJsdoc from 'swagger-jsdoc'

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BAN-Platform API',
      version: '1.0.0',
      // eslint-disable-next-line quotes
      description: "L'API plateforme.adresse.data.gouv.fr qui permet le téléversement et l'intégration des fichiers BAL envoyés par l'API de dépôt de l'ANCT dans des bases de données France entière (PostgreSQL ou MongoDB en fonction de la présence ou non d'identifiants)",
    },
    tags: [
      {
        name: '📊 Suivi, Statistiques & Recherche',
        description: 'Suivi des jobs, statistiques et recherche'
      },
      {
        name: '🗺️ Cartographie & Tuiles',
        description: 'Données cartographiques'
      },
      {
        name: '🏘️ Communes & Composition d’adresses',
        description: 'Outils pour les communes'
      },
      {
        name: '📍 Adresses',
        description: 'Opérations CRUD sur les adresses'
      },
      {
        name: '📛 common-toponym',
        description: 'Gestion des toponymes communs'
      },
      {
        name: '🏙️ Districts',
        description: 'Gestion des découpages administratifs'
      },
      {
        name: '📜 Certificats d’adressage',
        description: 'Gestion des certificats officiels'
      },
      {
        name: '🔄 Mises à jour des codes postaux',
        description: 'Synchronisation des zones postales'
      }
    ],
    components: {
      schemas: {
        INT_TIMESTAMP: {
          type: 'integer',
          description: 'Timestamp valide',
          example: '2025-01-21T10:46:09.785Z'
        },
        TYPE_ban_id: {
          type: 'string',
          description: 'Identifiant générique valide (UUID)',
          example: 'a950efd3-69e7-41df-b5d8-a47dc660b66e'
        },
        TYPE_ban_id_address: {
          allOf: [
            {
              $ref: '#/components/schemas/TYPE_ban_id',
            },
          ],
          description: 'Identifiant d\'une adresse',
          example: 'a950efd3-69e7-41df-b5d8-a47dc660b66e'
        },
        TYPE_ban_id_common_toponym: {
          allOf: [
            {
              $ref: '#/components/schemas/TYPE_ban_id',
            },
          ],
          description: 'Identifiant d\'un toponyme commun',
        },
        TYPE_ban_id_district: {
          allOf: [
            {
              $ref: '#/components/schemas/TYPE_ban_id',
            },
          ],
          description: 'Identifiant d\'un découpage administratif',
        },
        TYPE_json_ban_address: {
          type: 'object',
          properties: {
            id: {
              $ref: '#/components/schemas/TYPE_ban_id_address',
            },
            mainCommonToponymID: {
              $ref: '#/components/schemas/TYPE_ban_id_common_toponym',
            },
            secondaryCommonToponymIDs: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/TYPE_ban_id_common_toponym',
              },
            },
            districtID: {
              $ref: '#/components/schemas/TYPE_ban_id_district',
            },
            number: {
              type: 'integer',
              description: 'Numéro de l\'adresse',
            },
            suffix: {
              type: ['string', 'null'],
              description: 'Suffixe du numéro de l\'adresse',
            },
            labels: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  isoCode: {
                    type: 'string',
                  },
                  value: {
                    type: 'string',
                  },
                },
              },
            },
            certified: {
              type: 'boolean',
              description: 'Indique si l\'adresse est certifiée',
            },
            positions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    description: 'Type de position (ex : "entrance")',
                  },
                  geometry: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                      },
                      coordinates: {
                        type: 'array',
                        items: {
                          type: 'number',
                        },
                      },
                    },
                  },
                },
              },
            },
            updateDate: {
              type: 'string',
              format: 'date-time',
              description: 'Date de dernière mise à jour',
            },
            meta: {
              type: 'object',
              properties: {
                bal: {
                  type: 'object',
                  properties: {
                    cleInterop: {
                      type: 'string',
                      description: 'Clé d\'interopérabilité BAL',
                    },
                  },
                },
                idfix: {
                  type: 'object',
                  properties: {
                    hash: {
                      type: 'string',
                      description: 'Hash unique pour l\'adresse',
                    },
                  },
                },
                cadastre: {
                  type: 'object',
                  properties: {
                    ids: {
                      type: 'array',
                      items: {
                        type: 'string',
                      },
                    },
                  },
                },
              },
            },
            isActive: {
              type: 'boolean',
              description: 'Indique si l\'adresse est active',
            },
            lastRecordDate: {
              type: 'string',
              format: 'date-time',
              description: 'Date de dernière modification enregistrée',
            },
          },
        },
        TYPE_json_ban_common_toponym: {
          type: 'object',
          properties: {
            id: {
              $ref: '#/components/schemas/TYPE_ban_id_common_toponym',
            },
            districtID: {
              $ref: '#/components/schemas/TYPE_ban_id_district',
            },
            labels: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  isoCode: {
                    type: 'string',
                  },
                  value: {
                    type: 'string',
                  },
                },
              },
            },
            geometry: {
              type: ['object', 'null'],
              properties: {
                type: {
                  type: 'string',
                },
                coordinates: {
                  type: 'array',
                  items: {
                    type: 'number',
                  },
                },
              },
            },
            updateDate: {
              type: 'string',
              format: 'date-time',
            },
            meta: {
              type: 'object',
              properties: {
                bal: {
                  type: 'object',
                  properties: {
                    deprecatedID: {
                      type: 'string',
                      description: 'Ancien identifiant BAL',
                    },
                    nomAncienneCommune: {
                      type: 'string',
                      description: 'Nom de l\'ancienne commune',
                    },
                    codeAncienneCommune: {
                      type: 'string',
                      description: 'Code de l\'ancienne commune',
                    },
                  },
                },
                idfix: {
                  type: 'object',
                  properties: {
                    hash: {
                      type: 'string',
                      description: 'Hash unique de l\'adresse',
                    },
                  },
                },
              },
            },
            isActive: {
              type: 'boolean',
              description: 'Indique si le toponyme est actif',
            },
            lastRecordDate: {
              type: 'string',
              format: 'date-time',
              description: 'Date de dernière modification enregistrée',
            },
          },
        },
        TYPE_json_ban_district: {
          type: 'object',
          properties: {
            id: {
              $ref: '#/components/schemas/TYPE_ban_id_district',
            },
            labels: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  isoCode: {
                    type: 'string',
                  },
                  value: {
                    type: 'string',
                  },
                },
              },
            },
            updateDate: {
              type: 'string',
              format: 'date-time',
            },
            config: {
              type: 'object',
              properties: {
                certificate: {
                  type: 'object',
                  description: 'Configuration des certificats',
                },
              },
            },
            meta: {
              type: 'object',
              properties: {
                bal: {
                  type: 'object',
                  properties: {
                    idRevision: {
                      type: 'string',
                      description: 'Identifiant de la révision BAL',
                    },
                    dateRevision: {
                      type: 'string',
                      format: 'date-time',
                      description: 'Date de la révision BAL',
                    },
                  },
                },
                insee: {
                  type: 'object',
                  properties: {
                    cog: {
                      type: 'string',
                      description: 'Code officiel géographique INSEE',
                    },
                  },
                },
              },
            },
            isActive: {
              type: 'boolean',
              description: 'Indique si le district est actif',
            },
            lastRecordDate: {
              type: 'string',
              format: 'date-time',
              description: 'Date de dernière modification enregistrée',
            },
          },
        },
        TYPE_json_ban_certificate: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Identifiant unique du certificat'
            },
            address_id: {
              $ref: '#/components/schemas/TYPE_ban_id_address',
            },
            full_address: {
              type: 'object',
              properties: {
                cog: {
                  type: 'string',
                  description: 'Code officiel géographique INSEE',
                },
                number: {
                  type: 'integer',
                  description: 'Numéro de l adresse',
                },
                suffix: {
                  type: ['string', 'null'],
                  description: 'Suffixe éventuel de l adresse',
                },
                districtDefaultLabel: {
                  type: 'string',
                  description: 'Nom par défaut du district',
                },
                commonToponymDefaultLabel: {
                  type: 'string',
                  description: 'Nom du toponyme commun',
                },
              },
            },
            cadastre_ids: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Liste des identifiants cadastraux'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Date de création du certificat',
            },
          },
        },
        TYPE_api_response: {
          type: 'object',
          description: 'Réponse générique pour les API',
          properties: {
            date: {
              type: 'string',
              format: 'date-time',
              description: 'Date et heure de la réponse.',
            },
            status: {
              type: 'string',
              enum: ['success', 'error'],
              description: 'Statut de la réponse (succès ou erreur).',
            },
            message: {
              type: 'string',
              description: 'Message détaillant le statut ou les éventuelles erreurs.',
            },
            response: {
              type: 'object',
              properties: {
                statusID: {
                  type: 'string',
                  description: 'Identifiant unique permettant de vérifier l\'état de la tâche.',
                },
              },
            },
          },
        },
      },
    },
  },
  apis: ['./lib/api/**/*.js', './lib/api/*.cjs'], // Paths to files containing OpenAPI definitions
}

const specs = swaggerJsdoc(options)

export default specs
