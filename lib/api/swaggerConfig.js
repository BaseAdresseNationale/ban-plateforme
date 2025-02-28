/* eslint-disable unicorn/filename-case */
/* eslint-disable camelcase */
import swaggerJsdoc from 'swagger-jsdoc'

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Your API Title',
      version: '1.0.0',
      description: 'A description of your API',
    },
    components: {
      schemas: {
        INT_TIMESTAMP: {
          type: 'integer',
          description: 'Timestamp valide',
        },
        TYPE_ban_id: {
          type: 'string',
          description: 'Identifiant générique valide (UUID)',
        },
        TYPE_ban_id_address: {
          allOf: [
            {
              $ref: '#/components/schemas/TYPE_ban_id',
            },
          ],
          description: 'Identifiant d\'une adresse',
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
          allOf: [
            {
              $ref: '#/components/schemas/TYPE_json_ban',
            },
          ],
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
            positions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    // eslint-disable-next-line no-useless-escape
                    description: 'Type de position (ex : \"entrance\")',
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
              format: 'date',
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
            updateDate: {
              type: 'string',
              format: 'date',
            },
          },
        },
        TYPE_json_ban_district: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              format: 'date-time',
            },
            status: {
              type: 'string',
              enum: ['success', 'error'],
            },
            response: {
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
                  format: 'date',
                },
                meta: {
                  type: 'object',
                  properties: {
                    insee: {
                      type: 'object',
                      properties: {
                        cog: {
                          type: 'string',
                        },
                      },
                    },
                  },
                },
              },
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
  apis: ['./lib/api/**/*.js'], // Paths to files containing OpenAPI definitions
}

const specs = swaggerJsdoc(options)

export default specs
