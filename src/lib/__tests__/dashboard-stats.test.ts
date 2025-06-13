jest.mock('../db', () => {
  const originalModule = jest.requireActual('../db');
  return {
    ...originalModule,
    getDB: jest.fn(),
    getRequestLogs: jest.fn()
  };
});

import { getDashboardStats, getDB, getRequestLogs } from '../db';

// Mock data type definitions based on actual types in the system
interface ApiEndpoint {
  id: string;
  enabled: boolean;
}

interface Integration {
  id: string;
  enabled: boolean;
}

interface LogEntry {
  id: string;
  apiEndpointId: string;
  integrations: Array<{
    integrationId: string;
    status: 'success' | 'failed_transformation' | 'failed_relay' | 'skipped';
  }>;
}

describe('getDashboardStats', () => {
  // Mock data for testing
  const mockEndpoints: ApiEndpoint[] = [
    { id: 'endpoint1', enabled: true },
    { id: 'endpoint2', enabled: true },
    { id: 'endpoint3', enabled: false }
  ];

  const mockIntegrations: Integration[] = [
    { id: 'integration1', enabled: true },
    { id: 'integration2', enabled: true },
    { id: 'integration3', enabled: false }
  ];

  const mockLogs: LogEntry[] = [
    {
      id: 'log1',
      apiEndpointId: 'endpoint1',
      integrations: [
        { integrationId: 'integration1', status: 'success' },
        { integrationId: 'integration2', status: 'failed_relay' },
        { integrationId: 'integration3', status: 'success' } // inactive integration
      ]
    },
    {
      id: 'log2',
      apiEndpointId: 'endpoint2',
      integrations: [
        { integrationId: 'integration1', status: 'success' },
        { integrationId: 'integration2', status: 'success' }
      ]
    },
    {
      id: 'log3',
      apiEndpointId: 'endpoint3', // inactive endpoint
      integrations: [
        { integrationId: 'integration1', status: 'success' },
        { integrationId: 'integration3', status: 'failed_relay' } // inactive integration
      ]
    }
  ];

  beforeEach(() => {
    // Mock the required functions before importing the module
    jest.mock('../db', () => {
      const originalModule = jest.requireActual('../db');
      return {
        ...originalModule,
        getDB: () => ({
          prepare: (query: string) => ({
            get: () => {
              if (query.includes('integrations WHERE enabled = 1')) {
                return { count: mockIntegrations.filter(i => i.enabled).length };
              }
              if (query.includes('api_endpoints WHERE enabled = 1')) {
                return { count: mockEndpoints.filter(e => e.enabled).length };
              }
              if (query.includes('request_logs WHERE apiEndpointId IN')) {
                return { count: mockLogs.filter(l => 
                  mockEndpoints.find(e => e.id === l.apiEndpointId)?.enabled
                ).length };
              }
              return { count: 0 };
            },
            all: () => mockIntegrations
              .filter(i => i.enabled)
              .map(i => ({ id: i.id }))
          })
        }),
        getRequestLogs: () => Promise.resolve(mockLogs)
      };
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should only count active integrations and endpoints', async () => {
    const stats = await getDashboardStats();

    // Should only count enabled integrations
    expect(stats.activeIntegrationsCount).toBe(2);

    // Should only count enabled endpoints
    expect(stats.apiEndpointsCount).toBe(2);

    // Should only count requests to enabled endpoints
    expect(stats.relayedNotificationsCount).toBe(2); // logs for endpoint1 and endpoint2
  });

  it('should only include attempts from active integrations in metrics', async () => {
    const stats = await getDashboardStats();

    // Total attempts should only include active integrations
    expect(stats.totalOutboundAttempts).toBe(4); // 2 from log1 + 2 from log2 (excluding inactive integration3)

    // Success count should only include active integrations
    expect(stats.outboundSuccessCount).toBe(3); // integration1 x2 + integration2 x1

    // Failure count should only include active integrations
    expect(stats.outboundFailureCount).toBe(1); // integration2 x1
  });

  it('should calculate correct success rate from active integrations', async () => {
    const stats = await getDashboardStats();

    // Success rate should be based only on active integration attempts
    // 3 successes out of 4 total attempts = 75%
    expect(stats.outboundSuccessRate).toBe(75);
  });
});
