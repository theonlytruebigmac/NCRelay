/**
 * OpenAPI 3.0 Specification for NCRelay API
 */
export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'NCRelay API',
    version: '1.0.0',
    description: `
# NCRelay API Documentation

NCRelay is a notification relay and processing platform that receives notifications from monitoring systems (like N-Central) and forwards them to various collaboration platforms (Discord, Slack, Microsoft Teams, etc.).

## Authentication

Most management endpoints require authentication via session cookies. Admin privileges are required for management operations.

The custom webhook endpoints (\`/api/custom/{endpointPath}\`) can be accessed without authentication but may be restricted by IP whitelisting.

## Rate Limiting

Rate limits are enforced per tenant to prevent abuse. Limits are configurable in the system settings.

## Key Features

- Custom webhook endpoints with UUID paths for security
- Multi-platform notification delivery (Discord, Slack, Teams, etc.)
- Queue-based reliable delivery with retries
- Field filtering and transformation
- IP whitelisting
- Real-time monitoring
- Multi-tenancy support
    `,
    contact: {
      name: 'NCRelay Support',
      email: 'support@example.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: '/api',
      description: 'NCRelay API Server'
    }
  ],
  tags: [
    {
      name: 'Webhooks',
      description: 'Custom webhook endpoints for receiving notifications'
    },
    {
      name: 'Queue Management',
      description: 'Manage notification queue and processing'
    },
    {
      name: 'Monitoring',
      description: 'Real-time monitoring and metrics'
    },
    {
      name: 'Health',
      description: 'System health and status checks'
    },
    {
      name: 'Metrics',
      description: 'Prometheus metrics endpoint'
    }
  ],
  paths: {
    '/custom/{endpointPath}': {
      post: {
        tags: ['Webhooks'],
        summary: 'Receive and relay webhook notification',
        description: `
Receives a webhook notification (typically XML from N-Central) and relays it to configured integrations.

**Features:**
- Automatic XML parsing and transformation
- Platform-specific formatting (Discord, Slack, Teams, etc.)
- Field filtering support
- IP whitelisting
- Queue-based delivery with retry logic

**Security:**
- UUID-based paths prevent enumeration
- Optional IP whitelisting
- Request logging for audit trail
        `,
        operationId: 'postCustomWebhook',
        parameters: [
          {
            name: 'endpointPath',
            in: 'path',
            required: true,
            description: 'UUID path of the custom endpoint (generated when creating endpoint)',
            schema: {
              type: 'string',
              format: 'uuid',
              example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
            }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/xml': {
              schema: {
                type: 'string',
                example: `<?xml version="1.0"?>
<notification>
  <subject>Server Alert</subject>
  <message>CPU usage high on server-01</message>
  <severity>warning</severity>
  <timestamp>2024-01-15T10:30:00Z</timestamp>
</notification>`
              }
            },
            'text/xml': {
              schema: {
                type: 'string'
              }
            },
            'application/json': {
              schema: {
                type: 'object',
                example: {
                  subject: 'Server Alert',
                  message: 'CPU usage high on server-01',
                  severity: 'warning',
                  timestamp: '2024-01-15T10:30:00Z'
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Notification received and queued successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'Notification received and queued for delivery'
                    },
                    queuedCount: {
                      type: 'number',
                      example: 2
                    },
                    integrations: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          status: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Bad request - invalid payload',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          '403': {
            description: 'IP address not whitelisted',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          '404': {
            description: 'Endpoint not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          }
        }
      },
      get: {
        tags: ['Webhooks'],
        summary: 'Get endpoint information',
        description: 'Returns basic information about the endpoint for testing/verification. Does not process notifications.',
        operationId: 'getCustomWebhook',
        parameters: [
          {
            name: 'endpointPath',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Endpoint information',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'active' },
                    message: { type: 'string', example: 'This is a POST-only endpoint for receiving webhooks.' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/management/queue': {
      get: {
        tags: ['Queue Management'],
        summary: 'Get queue statistics or notifications',
        description: 'Retrieve queue statistics or list notifications by status. Admin authentication required.',
        operationId: 'getQueue',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'status',
            in: 'query',
            description: 'Filter by notification status',
            schema: {
              type: 'string',
              enum: ['pending', 'processing', 'completed', 'failed']
            }
          },
          {
            name: 'id',
            in: 'query',
            description: 'Get specific notification by ID',
            schema: {
              type: 'string',
              format: 'uuid'
            }
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum number of results',
            schema: {
              type: 'integer',
              default: 50
            }
          }
        ],
        responses: {
          '200': {
            description: 'Queue statistics or notifications',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { $ref: '#/components/schemas/QueueStats' },
                    {
                      type: 'array',
                      items: { $ref: '#/components/schemas/QueuedNotification' }
                    },
                    { $ref: '#/components/schemas/QueuedNotification' }
                  ]
                }
              }
            }
          },
          '403': {
            description: 'Unauthorized - Admin access required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      },
      post: {
        tags: ['Queue Management'],
        summary: 'Perform queue operations',
        description: 'Retry, process, cleanup, pause, or delete notifications. Admin authentication required.',
        operationId: 'manageQueue',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['action'],
                properties: {
                  action: {
                    type: 'string',
                    enum: ['retry', 'process', 'cleanup', 'pause', 'delete'],
                    description: 'Action to perform'
                  },
                  id: {
                    type: 'string',
                    format: 'uuid',
                    description: 'Notification ID (required for retry, pause, delete)'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Operation completed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    processed: { type: 'number' },
                    succeeded: { type: 'number' },
                    failed: { type: 'number' },
                    deleted: { type: 'number' }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
          '403': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    },
    '/management/queue/bulk': {
      post: {
        tags: ['Queue Management'],
        summary: 'Perform bulk queue operations',
        description: 'Retry, delete, or cancel multiple notifications at once. Admin authentication required.',
        operationId: 'bulkManageQueue',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['action', 'ids'],
                properties: {
                  action: {
                    type: 'string',
                    enum: ['retry', 'delete', 'cancel'],
                    description: 'Bulk action to perform'
                  },
                  ids: {
                    type: 'array',
                    items: {
                      type: 'string',
                      format: 'uuid'
                    },
                    minItems: 1,
                    maxItems: 100,
                    description: 'Array of notification IDs (max 100)'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Bulk operation completed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    results: {
                      type: 'object',
                      properties: {
                        successful: { type: 'number' },
                        failed: { type: 'number' },
                        errors: {
                          type: 'array',
                          items: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/management/queue/status': {
      get: {
        tags: ['Queue Management'],
        summary: 'Get queue processing status',
        description: 'Check if queue processing is enabled or paused. Admin authentication required.',
        operationId: 'getQueueStatus',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Queue processing status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    enabled: {
                      type: 'boolean',
                      description: 'Whether queue processing is enabled'
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Queue Management'],
        summary: 'Set queue processing status',
        description: 'Enable or pause queue processing. Admin authentication required.',
        operationId: 'setQueueStatus',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['enabled'],
                properties: {
                  enabled: {
                    type: 'boolean',
                    description: 'Set queue processing enabled state'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Status updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    enabled: { type: 'boolean' },
                    message: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/monitoring/live': {
      get: {
        tags: ['Monitoring'],
        summary: 'Get real-time monitoring data',
        description: 'Retrieve live system metrics, queue statistics, and integration health. Admin authentication required.',
        operationId: 'getLiveMonitoring',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Real-time monitoring data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    queueStats: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          status: { type: 'string' },
                          count: { type: 'number' },
                          avgRetries: { type: 'number' }
                        }
                      }
                    },
                    recentActivity: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          timestamp: { type: 'string', format: 'date-time' },
                          method: { type: 'string' },
                          apiEndpointName: { type: 'string' },
                          status: { type: 'string' }
                        }
                      }
                    },
                    integrationHealth: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          platform: { type: 'string' },
                          enabled: { type: 'boolean' },
                          successCount: { type: 'number' },
                          failedCount: { type: 'number' },
                          totalCount: { type: 'number' }
                        }
                      }
                    },
                    overview: {
                      type: 'object',
                      properties: {
                        activeEndpoints: { type: 'number' },
                        activeIntegrations: { type: 'number' },
                        successRate: { type: 'number' },
                        avgResponseTime: { type: 'number' },
                        queueDepth: { type: 'number' }
                      }
                    },
                    systemMetrics: {
                      type: 'object',
                      properties: {
                        uptime: { type: 'number' },
                        memory: {
                          type: 'object',
                          properties: {
                            heapUsed: { type: 'number' },
                            heapTotal: { type: 'number' },
                            rss: { type: 'number' }
                          }
                        },
                        cpu: {
                          type: 'object',
                          properties: {
                            user: { type: 'number' },
                            system: { type: 'number' }
                          }
                        }
                      }
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check endpoint',
        description: 'Returns system health status including database, queue, and overall system health.',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'System health status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      enum: ['ok', 'degraded', 'error'],
                      description: 'Overall system health status'
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time'
                    },
                    checks: {
                      type: 'object',
                      properties: {
                        database: {
                          type: 'object',
                          properties: {
                            status: { type: 'string' },
                            message: { type: 'string' }
                          }
                        },
                        queue: {
                          type: 'object',
                          properties: {
                            status: { type: 'string' },
                            details: {
                              type: 'object',
                              properties: {
                                total: { type: 'number' },
                                pending: { type: 'number' },
                                processing: { type: 'number' },
                                failed: { type: 'number' }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/metrics': {
      get: {
        tags: ['Metrics'],
        summary: 'Prometheus metrics endpoint',
        description: 'Returns metrics in Prometheus format for monitoring and alerting.',
        operationId: 'getMetrics',
        responses: {
          '200': {
            description: 'Prometheus metrics',
            content: {
              'text/plain': {
                schema: {
                  type: 'string',
                  example: `# HELP ncrelay_queue_size Current queue size by status
# TYPE ncrelay_queue_size gauge
ncrelay_queue_size{status="pending"} 42
ncrelay_queue_size{status="failed"} 5`
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      sessionAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'session',
        description: 'Session-based authentication using HTTP-only cookies'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error message'
          },
          details: {
            type: 'string',
            description: 'Additional error details'
          }
        }
      },
      QueueStats: {
        type: 'object',
        properties: {
          pending: { type: 'number', description: 'Number of pending notifications' },
          processing: { type: 'number', description: 'Number of processing notifications' },
          completed: { type: 'number', description: 'Number of completed notifications' },
          failed: { type: 'number', description: 'Number of failed notifications' },
          total: { type: 'number', description: 'Total number of notifications' }
        }
      },
      QueuedNotification: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          status: {
            type: 'string',
            enum: ['pending', 'processing', 'completed', 'failed']
          },
          priority: { type: 'number' },
          maxRetries: { type: 'number' },
          retryCount: { type: 'number' },
          nextRetryAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          lastAttemptAt: { type: 'string', format: 'date-time', nullable: true },
          integrationId: { type: 'string', format: 'uuid' },
          integrationName: { type: 'string' },
          platform: {
            type: 'string',
            enum: ['discord', 'slack', 'teams', 'webhook', 'email']
          },
          webhookUrl: { type: 'string' },
          payload: { type: 'string' },
          contentType: { type: 'string' },
          errorDetails: { type: 'string', nullable: true },
          responseStatus: { type: 'number', nullable: true },
          responseBody: { type: 'string', nullable: true },
          apiEndpointId: { type: 'string', format: 'uuid' },
          apiEndpointName: { type: 'string' },
          apiEndpointPath: { type: 'string' },
          originalRequestId: { type: 'string' }
        }
      }
    }
  }
};
