/**
 * OpenAPI 3.0 Specification for NCRelay Admin API
 * System administrator endpoints for managing the SaaS platform
 */
export const openApiAdminSpec = {
  openapi: '3.0.0',
  info: {
    title: 'NCRelay Admin API',
    version: '1.0.0',
    description: `
# NCRelay Admin API Documentation

System administrator API for managing the NCRelay SaaS platform. These endpoints are only accessible to system administrators.

## Authentication

All admin endpoints require:
- Valid session authentication (cookie-based)
- System administrator privileges (\`isAdmin: true\`)

## Multi-Tenancy

Admin endpoints provide cross-tenant visibility and management capabilities for operating the SaaS platform.

## Key Capabilities

- Tenant management (create, update, delete tenants)
- User management across tenants
- System-wide audit logs
- Global security policies (IP whitelisting/blacklisting)
- Account lockout management
- Session management
- System monitoring
`,
    contact: {
      name: 'NCRelay Support',
      email: 'support@example.com'
    }
  },
  servers: [
    {
      url: '/api',
      description: 'NCRelay Admin API Server'
    }
  ],
  tags: [
    {
      name: 'Tenants',
      description: 'Manage tenants (organizations) on the platform'
    },
    {
      name: 'Users',
      description: 'Cross-tenant user management'
    },
    {
      name: 'Security',
      description: 'Global security policies and controls'
    },
    {
      name: 'Audit',
      description: 'System-wide audit logging'
    },
    {
      name: 'Sessions',
      description: 'Active session management'
    },
    {
      name: 'Authentication',
      description: 'User authentication and session management'
    },
    {
      name: 'Webhooks',
      description: 'Custom webhook endpoints'
    },
    {
      name: 'Queue Management',
      description: 'Notification queue operations'
    },
    {
      name: 'Monitoring',
      description: 'System monitoring and metrics'
    },
    {
      name: 'Utilities',
      description: 'Utility endpoints for filtering and testing'
    }
  ],
  paths: {
    '/tenants': {
      get: {
        tags: ['Tenants'],
        summary: 'List all tenants',
        description: 'Retrieve a list of all tenants on the platform with their status and metadata.',
        operationId: 'listTenants',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'List of tenants',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Tenant'
                  }
                }
              }
            }
          },
          '401': {
            description: 'Not authenticated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
          '403': {
            description: 'Not authorized (system admin required)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      },
      post: {
        tags: ['Tenants'],
        summary: 'Create new tenant',
        description: 'Create a new tenant organization on the platform.',
        operationId: 'createTenant',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'slug'],
                properties: {
                  name: {
                    type: 'string',
                    description: 'Display name of the tenant',
                    example: 'Acme Corporation'
                  },
                  slug: {
                    type: 'string',
                    description: 'URL-friendly identifier',
                    example: 'acme-corp'
                  },
                  status: {
                    type: 'string',
                    enum: ['active', 'suspended', 'inactive'],
                    default: 'active'
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Tenant created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Tenant' }
              }
            }
          },
          '400': {
            description: 'Invalid request data',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
          '403': {
            description: 'Not authorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    },
    '/tenants/{id}': {
      get: {
        tags: ['Tenants'],
        summary: 'Get tenant details',
        description: 'Retrieve detailed information about a specific tenant.',
        operationId: 'getTenant',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Tenant ID',
            schema: {
              type: 'string',
              format: 'uuid'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Tenant details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Tenant' }
              }
            }
          },
          '404': {
            description: 'Tenant not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      },
      patch: {
        tags: ['Tenants'],
        summary: 'Update tenant',
        description: 'Update tenant information and settings.',
        operationId: 'updateTenant',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  status: {
                    type: 'string',
                    enum: ['active', 'suspended', 'inactive']
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Tenant updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Tenant' }
              }
            }
          },
          '404': {
            description: 'Tenant not found'
          }
        }
      },
      delete: {
        tags: ['Tenants'],
        summary: 'Delete tenant',
        description: 'Permanently delete a tenant and all associated data.',
        operationId: 'deleteTenant',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '200': {
            description: 'Tenant deleted successfully'
          },
          '404': {
            description: 'Tenant not found'
          }
        }
      }
    },
    '/admin/users': {
      get: {
        tags: ['Users'],
        summary: 'List all users across tenants',
        description: 'Retrieve a list of all users across all tenants. Supports filtering by tenant.',
        operationId: 'listAllUsers',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'tenantId',
            in: 'query',
            description: 'Filter by tenant ID',
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '200': {
            description: 'List of users',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/User' }
                }
              }
            }
          }
        }
      }
    },
    '/admin/users/{userId}': {
      get: {
        tags: ['Users'],
        summary: 'Get user details',
        description: 'Retrieve detailed information about a specific user.',
        operationId: 'getUser',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '200': {
            description: 'User details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' }
              }
            }
          }
        }
      },
      patch: {
        tags: ['Users'],
        summary: 'Update user',
        description: 'Update user information and status.',
        operationId: 'updateUser',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  status: {
                    type: 'string',
                    enum: ['active', 'inactive', 'suspended']
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'User updated'
          }
        }
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete user',
        description: 'Delete a user account.',
        operationId: 'deleteUser',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '200': {
            description: 'User deleted'
          }
        }
      }
    },
    '/admin/ip-management/global-whitelist': {
      get: {
        tags: ['Security'],
        summary: 'Get global IP whitelist',
        description: 'Retrieve the system-wide IP whitelist that applies to all tenants.',
        operationId: 'getGlobalWhitelist',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Global whitelist entries',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/IPEntry' }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Security'],
        summary: 'Add IP to global whitelist',
        description: 'Add an IP address or CIDR range to the global whitelist.',
        operationId: 'addGlobalWhitelist',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ipAddress'],
                properties: {
                  ipAddress: {
                    type: 'string',
                    description: 'IP address or CIDR range',
                    example: '203.0.113.0/24'
                  },
                  description: {
                    type: 'string',
                    example: 'Corporate VPN range'
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'IP added to whitelist'
          }
        }
      },
      delete: {
        tags: ['Security'],
        summary: 'Remove IP from global whitelist',
        description: 'Remove an IP address from the global whitelist.',
        operationId: 'removeGlobalWhitelist',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['id'],
                properties: {
                  id: {
                    type: 'string',
                    description: 'Whitelist entry ID'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'IP removed from whitelist'
          }
        }
      }
    },
    '/admin/ip-management/global-blacklist': {
      get: {
        tags: ['Security'],
        summary: 'Get global IP blacklist',
        description: 'Retrieve the system-wide IP blacklist that blocks IPs across all tenants.',
        operationId: 'getGlobalBlacklist',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Global blacklist entries',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/IPEntry' }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Security'],
        summary: 'Add IP to global blacklist',
        description: 'Add an IP address or CIDR range to the global blacklist.',
        operationId: 'addGlobalBlacklist',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ipAddress'],
                properties: {
                  ipAddress: { type: 'string' },
                  reason: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'IP added to blacklist'
          }
        }
      },
      delete: {
        tags: ['Security'],
        summary: 'Remove IP from global blacklist',
        operationId: 'removeGlobalBlacklist',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['id'],
                properties: {
                  id: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'IP removed from blacklist'
          }
        }
      }
    },
    '/admin/audit-logs': {
      get: {
        tags: ['Audit'],
        summary: 'Get system-wide audit logs',
        description: 'Retrieve audit logs across all tenants. Supports filtering by tenant, user, action, and date range.',
        operationId: 'getAuditLogs',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'tenantId',
            in: 'query',
            schema: { type: 'string', format: 'uuid' }
          },
          {
            name: 'userId',
            in: 'query',
            schema: { type: 'string', format: 'uuid' }
          },
          {
            name: 'action',
            in: 'query',
            schema: { type: 'string' }
          },
          {
            name: 'startDate',
            in: 'query',
            schema: { type: 'string', format: 'date-time' }
          },
          {
            name: 'endDate',
            in: 'query',
            schema: { type: 'string', format: 'date-time' }
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 100 }
          }
        ],
        responses: {
          '200': {
            description: 'Audit log entries',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/AuditLog' }
                }
              }
            }
          }
        }
      }
    },
    '/admin/sessions': {
      get: {
        tags: ['Sessions'],
        summary: 'Get all active sessions',
        description: 'Retrieve all active sessions across all tenants.',
        operationId: 'getAllSessions',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Active sessions',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Session' }
                }
              }
            }
          }
        }
      },
      delete: {
        tags: ['Sessions'],
        summary: 'Terminate session',
        description: 'Forcefully terminate a user session.',
        operationId: 'terminateSession',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['sessionId'],
                properties: {
                  sessionId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Session terminated'
          }
        }
      }
    },
    '/admin/lockouts': {
      get: {
        tags: ['Security'],
        summary: 'Get locked accounts',
        description: 'Retrieve list of accounts currently locked due to failed login attempts.',
        operationId: 'getLockedAccounts',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Locked accounts',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Lockout' }
                }
              }
            }
          }
        }
      },
      delete: {
        tags: ['Security'],
        summary: 'Unlock account',
        description: 'Manually unlock a locked user account.',
        operationId: 'unlockAccount',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['identifier'],
                properties: {
                  identifier: {
                    type: 'string',
                    description: 'Email or username of locked account'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Account unlocked'
          }
        }
      }
    },
    '/tenants/{id}/users': {
      get: {
        tags: ['Tenants'],
        summary: 'List users in tenant',
        description: 'Get all users belonging to a specific tenant.',
        operationId: 'getTenantUsers',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '200': {
            description: 'List of tenant users',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    users: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/User' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Tenants'],
        summary: 'Add user to tenant',
        description: 'Add an existing user or create a new user in the tenant.',
        operationId: 'addTenantUser',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  name: { type: 'string' },
                  password: { type: 'string', minLength: 8 },
                  role: { type: 'string' },
                  customRoleId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'User added to tenant'
          }
        }
      }
    },
    '/tenants/{id}/users/{userId}': {
      patch: {
        tags: ['Tenants'],
        summary: 'Update tenant user',
        description: 'Update user role or permissions within the tenant.',
        operationId: 'updateTenantUser',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          },
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  role: { type: 'string' },
                  customRoleId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'User updated'
          }
        }
      },
      delete: {
        tags: ['Tenants'],
        summary: 'Remove user from tenant',
        description: 'Remove a user from the tenant.',
        operationId: 'removeTenantUser',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          },
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '200': {
            description: 'User removed from tenant'
          }
        }
      }
    },
    '/tenants/{id}/roles': {
      get: {
        tags: ['Tenants'],
        summary: 'List tenant roles',
        description: 'Get all roles (built-in and custom) for a tenant.',
        operationId: 'getTenantRoles',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '200': {
            description: 'List of roles',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    builtInRoles: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Role' }
                    },
                    customRoles: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Role' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Tenants'],
        summary: 'Create custom role',
        description: 'Create a new custom role for the tenant.',
        operationId: 'createTenantRole',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'slug', 'permissions'],
                properties: {
                  name: { type: 'string', maxLength: 100 },
                  slug: { type: 'string', maxLength: 50, pattern: '^[a-z0-9_-]+$' },
                  description: { type: 'string' },
                  permissions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        resource: { type: 'string' },
                        action: { type: 'string' },
                        allowed: { type: 'boolean' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Role created'
          }
        }
      }
    },
    '/tenants/{id}/roles/{roleId}': {
      get: {
        tags: ['Tenants'],
        summary: 'Get role details',
        description: 'Get detailed information about a specific role.',
        operationId: 'getTenantRole',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          },
          {
            name: 'roleId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Role details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Role' }
              }
            }
          }
        }
      },
      patch: {
        tags: ['Tenants'],
        summary: 'Update custom role',
        description: 'Update a custom role (cannot update built-in roles).',
        operationId: 'updateTenantRole',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          },
          {
            name: 'roleId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  permissions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        resource: { type: 'string' },
                        action: { type: 'string' },
                        allowed: { type: 'boolean' }
                      }
                    }
                  },
                  isActive: { type: 'boolean' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Role updated'
          }
        }
      },
      delete: {
        tags: ['Tenants'],
        summary: 'Delete custom role',
        description: 'Delete a custom role (cannot delete built-in roles).',
        operationId: 'deleteTenantRole',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          },
          {
            name: 'roleId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Role deleted'
          }
        }
      }
    },
    '/tenants/{id}/permissions': {
      get: {
        tags: ['Tenants'],
        summary: 'Get tenant permissions',
        description: 'Get available permissions and resources for the tenant.',
        operationId: 'getTenantPermissions',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '200': {
            description: 'Available permissions',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    resources: {
                      type: 'array',
                      items: { type: 'string' }
                    },
                    actions: {
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
    },
    '/tenants/{id}/ip-management': {
      get: {
        tags: ['Tenants'],
        summary: 'Get tenant IP access lists',
        description: 'Get IP whitelist and blacklist for the tenant.',
        operationId: 'getTenantIPManagement',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '200': {
            description: 'IP access lists',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    whitelist: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/IPEntry' }
                    },
                    blacklist: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/IPEntry' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Tenants'],
        summary: 'Manage tenant IP access',
        description: 'Add or remove IPs from tenant whitelist/blacklist.',
        operationId: 'updateTenantIPManagement',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  action: {
                    type: 'string',
                    enum: ['add', 'remove']
                  },
                  listType: {
                    type: 'string',
                    enum: ['whitelist', 'blacklist']
                  },
                  ipAddress: { type: 'string' },
                  description: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'IP access updated'
          }
        }
      }
    },
    '/tenants/{id}/security': {
      get: {
        tags: ['Tenants'],
        summary: 'Get tenant security settings',
        description: 'Get security policies and settings for the tenant.',
        operationId: 'getTenantSecurity',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '200': {
            description: 'Security settings',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    twoFactorRequired: { type: 'boolean' },
                    sessionTimeout: { type: 'integer' },
                    passwordPolicy: {
                      type: 'object',
                      properties: {
                        minLength: { type: 'integer' },
                        requireUppercase: { type: 'boolean' },
                        requireLowercase: { type: 'boolean' },
                        requireNumbers: { type: 'boolean' },
                        requireSpecialChars: { type: 'boolean' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      patch: {
        tags: ['Tenants'],
        summary: 'Update tenant security settings',
        description: 'Update security policies for the tenant.',
        operationId: 'updateTenantSecurity',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  twoFactorRequired: { type: 'boolean' },
                  sessionTimeout: { type: 'integer' },
                  passwordPolicy: { type: 'object' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Security settings updated'
          }
        }
      }
    },
    '/tenants/{id}/smtp': {
      get: {
        tags: ['Tenants'],
        summary: 'Get tenant SMTP configuration',
        description: 'Get SMTP settings for the tenant.',
        operationId: 'getTenantSMTP',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '200': {
            description: 'SMTP configuration',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    host: { type: 'string' },
                    port: { type: 'integer' },
                    secure: { type: 'boolean' },
                    fromAddress: { type: 'string' },
                    fromName: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Tenants'],
        summary: 'Update tenant SMTP configuration',
        description: 'Configure SMTP settings for tenant email notifications.',
        operationId: 'updateTenantSMTP',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['host', 'port'],
                properties: {
                  host: { type: 'string' },
                  port: { type: 'integer' },
                  secure: { type: 'boolean' },
                  username: { type: 'string' },
                  password: { type: 'string' },
                  fromAddress: { type: 'string' },
                  fromName: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'SMTP configuration updated'
          }
        }
      }
    },
    '/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current user',
        description: 'Returns the currently authenticated user information.',
        operationId: 'getCurrentUser',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Current user information',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' }
              }
            }
          },
          '401': {
            description: 'Not authenticated'
          }
        }
      }
    },
    '/auth/sessions': {
      get: {
        tags: ['Authentication'],
        summary: 'Get user sessions',
        description: 'Get all active sessions for the current user.',
        operationId: 'getUserSessions',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'User sessions',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Session' }
                }
              }
            }
          }
        }
      },
      delete: {
        tags: ['Authentication'],
        summary: 'Revoke session',
        description: 'Revoke a specific session or all sessions except current.',
        operationId: 'revokeSession',
        security: [{ sessionAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  sessionId: { type: 'string' },
                  revokeAll: { type: 'boolean' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Session(s) revoked'
          }
        }
      }
    },
    '/auth/2fa/status': {
      get: {
        tags: ['Authentication'],
        summary: 'Get 2FA status',
        description: 'Check if 2FA is enabled for the current user.',
        operationId: 'get2FAStatus',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: '2FA status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    enabled: { type: 'boolean' },
                    method: { type: 'string', enum: ['totp', 'none'] }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/auth/2fa/setup': {
      post: {
        tags: ['Authentication'],
        summary: 'Setup 2FA',
        description: 'Generate QR code and secret for TOTP 2FA setup.',
        operationId: 'setup2FA',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: '2FA setup information',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    secret: { type: 'string' },
                    qrCode: { type: 'string', description: 'Base64 QR code image' },
                    backupCodes: {
                      type: 'array',
                      items: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      delete: {
        tags: ['Authentication'],
        summary: 'Disable 2FA',
        description: 'Disable 2FA for the current user.',
        operationId: 'disable2FA',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['password'],
                properties: {
                  password: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: '2FA disabled'
          }
        }
      }
    },
    '/auth/2fa/verify': {
      post: {
        tags: ['Authentication'],
        summary: 'Verify 2FA code',
        description: 'Verify TOTP code to complete login or enable 2FA.',
        operationId: 'verify2FA',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code'],
                properties: {
                  code: { type: 'string', minLength: 6, maxLength: 6 },
                  trustDevice: { type: 'boolean' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: '2FA verified successfully'
          },
          '401': {
            description: 'Invalid code'
          }
        }
      }
    },
    '/auth/check-pending-2fa': {
      get: {
        tags: ['Authentication'],
        summary: 'Check pending 2FA',
        description: 'Check if user has pending 2FA verification after initial login.',
        operationId: 'checkPending2FA',
        responses: {
          '200': {
            description: '2FA pending status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    pending: { type: 'boolean' },
                    userId: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/auth/reset-password/request': {
      post: {
        tags: ['Authentication'],
        summary: 'Request password reset',
        description: 'Request a password reset email.',
        operationId: 'requestPasswordReset',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', format: 'email' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Reset email sent (or silently ignored if email not found)'
          }
        }
      }
    },
    '/auth/reset-password/reset': {
      post: {
        tags: ['Authentication'],
        summary: 'Reset password',
        description: 'Reset password using token from email.',
        operationId: 'resetPassword',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'newPassword'],
                properties: {
                  token: { type: 'string' },
                  newPassword: { type: 'string', minLength: 8 }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Password reset successfully'
          },
          '400': {
            description: 'Invalid or expired token'
          }
        }
      }
    },
    '/admin/users/{userId}/2fa': {
      delete: {
        tags: ['Users'],
        summary: 'Reset user 2FA',
        description: 'Admin endpoint to reset/disable 2FA for a user.',
        operationId: 'resetUser2FA',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '200': {
            description: '2FA reset for user'
          }
        }
      }
    },
    '/audit-logs': {
      get: {
        tags: ['Audit'],
        summary: 'Get tenant audit logs',
        description: 'Retrieve audit logs for the current user\'s tenant. Filtered to tenant scope.',
        operationId: 'getTenantAuditLogs',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'userId',
            in: 'query',
            schema: { type: 'string', format: 'uuid' }
          },
          {
            name: 'action',
            in: 'query',
            schema: { type: 'string' }
          },
          {
            name: 'startDate',
            in: 'query',
            schema: { type: 'string', format: 'date-time' }
          },
          {
            name: 'endDate',
            in: 'query',
            schema: { type: 'string', format: 'date-time' }
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 100 }
          }
        ],
        responses: {
          '200': {
            description: 'Tenant audit logs',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/AuditLog' }
                }
              }
            }
          }
        }
      }
    },
    '/notify': {
      post: {
        tags: ['Utilities'],
        summary: 'Internal notification dispatch',
        description: 'Internal endpoint for dispatching notifications. Typically called by webhook processing.',
        operationId: 'dispatchNotification',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  integrationId: { type: 'string' },
                  message: { type: 'object' },
                  priority: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Notification dispatched'
          }
        }
      }
    },
    '/filters/extract-fields': {
      post: {
        tags: ['Utilities'],
        summary: 'Extract fields from data',
        description: 'Utility endpoint to extract and transform fields from notification data.',
        operationId: 'extractFields',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { type: 'object' },
                  filters: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        field: { type: 'string' },
                        operator: { type: 'string' },
                        value: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Extracted fields',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    fields: { type: 'object' },
                    matched: { type: 'boolean' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/filters/test-extract': {
      post: {
        tags: ['Utilities'],
        summary: 'Test field extraction',
        description: 'Test field extraction rules without saving.',
        operationId: 'testExtractFields',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  sampleData: { type: 'string', description: 'XML or JSON sample' },
                  filters: { type: 'array' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Test results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    extractedFields: { type: 'object' },
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
    },
    '/custom/{endpointPath}': {
      post: {
        tags: ['Webhooks'],
        summary: 'Receive webhook notification',
        description: 'Public webhook endpoint for receiving notifications. See tenant API docs for full details.',
        operationId: 'receiveWebhook',
        parameters: [
          {
            name: 'endpointPath',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/xml': {
              schema: { type: 'string' }
            },
            'application/json': {
              schema: { type: 'object' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Notification received'
          }
        }
      }
    },
    '/management/queue': {
      get: {
        tags: ['Queue Management'],
        summary: 'Get queue statistics',
        description: 'Retrieve notification queue statistics and items. See tenant API docs for full details.',
        operationId: 'getQueueStats',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Queue statistics'
          }
        }
      }
    },
    '/management/queue/bulk': {
      post: {
        tags: ['Queue Management'],
        summary: 'Bulk queue operations',
        description: 'Perform bulk operations on queue items (retry, delete, cancel). See tenant API docs for full details.',
        operationId: 'bulkQueueOperation',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Bulk operation completed'
          }
        }
      }
    },
    '/management/queue/status': {
      get: {
        tags: ['Queue Management'],
        summary: 'Get queue processing status',
        description: 'Get current queue processing status.',
        operationId: 'getQueueStatus',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Queue status'
          }
        }
      },
      post: {
        tags: ['Queue Management'],
        summary: 'Control queue processing',
        description: 'Start, stop, or pause queue processing.',
        operationId: 'controlQueue',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Queue control updated'
          }
        }
      }
    },
    '/management/logs': {
      get: {
        tags: ['Queue Management'],
        summary: 'Get request logs',
        description: 'Retrieve webhook request logs for the tenant.',
        operationId: 'getRequestLogs',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 100 }
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', default: 0 }
          }
        ],
        responses: {
          '200': {
            description: 'Request logs',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      timestamp: { type: 'string', format: 'date-time' },
                      method: { type: 'string' },
                      status: { type: 'string' },
                      endpoint: { type: 'string' }
                    }
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
        summary: 'Get live monitoring metrics',
        description: 'Real-time monitoring metrics. See tenant API docs for full details.',
        operationId: 'getLiveMetrics',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Live metrics'
          }
        }
      }
    },
    '/health': {
      get: {
        tags: ['Monitoring'],
        summary: 'Health check',
        description: 'System health status. See tenant API docs for full details.',
        operationId: 'healthCheck',
        responses: {
          '200': {
            description: 'System healthy'
          }
        }
      }
    },
    '/metrics': {
      get: {
        tags: ['Monitoring'],
        summary: 'Prometheus metrics',
        description: 'Prometheus-format metrics. See tenant API docs for full details.',
        operationId: 'getMetrics',
        responses: {
          '200': {
            description: 'Prometheus metrics',
            content: {
              'text/plain': {
                schema: { type: 'string' }
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
        description: 'Session-based authentication via HTTP-only cookie'
      }
    },
    schemas: {
      Tenant: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
          status: {
            type: 'string',
            enum: ['active', 'suspended', 'inactive']
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'suspended']
          },
          isAdmin: { type: 'boolean' },
          twoFactorEnabled: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          lastLoginAt: { type: 'string', format: 'date-time' }
        }
      },
      IPEntry: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          ipAddress: { type: 'string' },
          description: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          createdBy: { type: 'string' }
        }
      },
      AuditLog: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          action: { type: 'string' },
          resource: { type: 'string' },
          resourceId: { type: 'string' },
          details: { type: 'object' },
          ipAddress: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      },
      Session: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid' },
          ipAddress: { type: 'string' },
          userAgent: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          expiresAt: { type: 'string', format: 'date-time' }
        }
      },
      Lockout: {
        type: 'object',
        properties: {
          identifier: { type: 'string' },
          tenantId: { type: 'string', format: 'uuid' },
          failedAttempts: { type: 'integer' },
          lockedUntil: { type: 'string', format: 'date-time' },
          lastAttemptAt: { type: 'string', format: 'date-time' }
        }
      },
      Role: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string' },
          isBuiltIn: { type: 'boolean' },
          isActive: { type: 'boolean' },
          permissions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                resource: { type: 'string' },
                action: { type: 'string' },
                allowed: { type: 'boolean' }
              }
            }
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
          statusCode: { type: 'integer' }
        }
      }
    }
  }
};
