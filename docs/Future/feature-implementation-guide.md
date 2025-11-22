# NCRelay Feature Implementation Guide

This guide provides detailed, step-by-step instructions for implementing all 16 planned features. Each feature includes database changes (already in migration 018), backend implementation, and frontend UI.

---

## Table of Contents

1. [API Key Authentication](#1-api-key-authentication)
2. [Webhook Testing Interface](#2-webhook-testing-interface)
3. [Webhook Signature Verification (HMAC)](#3-webhook-signature-verification-hmac)
4. [Real-Time Monitoring Dashboard](#4-real-time-monitoring-dashboard)
5. [Advanced Analytics Dashboard](#5-advanced-analytics-dashboard)
6. [Notification Retry Management](#6-notification-retry-management)
7. [Public Health Status Page](#7-public-health-status-page)
8. [Interactive API Documentation](#8-interactive-api-documentation)
9. [Notification Templates & Transformations](#9-notification-templates--transformations)
10. [Export/Import Configuration](#10-exportimport-configuration)
11. [Enhanced Dark Mode](#11-enhanced-dark-mode)
12. [Bulk Operations](#12-bulk-operations)
13. [Advanced Search & Filtering](#13-advanced-search--filtering)
14. [Parallel Webhook Delivery](#14-parallel-webhook-delivery)
15. [Request Caching](#15-request-caching)
16. [Alerting & Notifications](#16-alerting--notifications)

---

## 1. API Key Authentication

**Effort:** 3-4 hours
**Priority:** High
**Dependencies:** Migration 018 (completed)

### Database Schema
Already created in migration 018:
```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  endpointId TEXT NOT NULL,
  keyHash TEXT NOT NULL,
  name TEXT NOT NULL,
  lastUsedAt TEXT,
  enabled INTEGER DEFAULT 1,
  createdAt TEXT NOT NULL,
  expiresAt TEXT,
  FOREIGN KEY (endpointId) REFERENCES api_endpoints(id) ON DELETE CASCADE
);
```

### Backend Implementation

#### Step 1: Add API Key CRUD to db.ts
```typescript
// src/lib/db.ts

import crypto from 'crypto';

export interface ApiKey {
  id: string;
  endpointId: string;
  keyHash: string;
  name: string;
  lastUsedAt?: string;
  enabled: boolean;
  createdAt: string;
  expiresAt?: string;
}

// Generate API key (plain text returned once)
export async function createApiKey(
  endpointId: string,
  name: string,
  expiresAt?: string
): Promise<{ key: string; apiKey: ApiKey }> {
  const db = await getDB();

  // Generate random API key
  const key = `nck_${crypto.randomBytes(32).toString('hex')}`;

  // Hash the key for storage (use bcrypt like passwords)
  const bcrypt = await import('bcryptjs');
  const keyHash = await bcrypt.hash(key, 10);

  const apiKey: ApiKey = {
    id: uuidv4(),
    endpointId,
    keyHash,
    name,
    enabled: true,
    createdAt: new Date().toISOString(),
    expiresAt
  };

  const stmt = db.prepare(`
    INSERT INTO api_keys (id, endpointId, keyHash, name, enabled, createdAt, expiresAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    apiKey.id,
    apiKey.endpointId,
    apiKey.keyHash,
    apiKey.name,
    apiKey.enabled ? 1 : 0,
    apiKey.createdAt,
    apiKey.expiresAt || null
  );

  return { key, apiKey };
}

export async function getApiKeysByEndpoint(endpointId: string): Promise<ApiKey[]> {
  const db = await getDB();
  const stmt = db.prepare('SELECT * FROM api_keys WHERE endpointId = ? ORDER BY createdAt DESC');
  const rows = stmt.all(endpointId) as any[];

  return rows.map(row => ({
    ...row,
    enabled: !!row.enabled
  }));
}

export async function verifyApiKey(endpointId: string, key: string): Promise<boolean> {
  const db = await getDB();
  const stmt = db.prepare(`
    SELECT keyHash, enabled, expiresAt
    FROM api_keys
    WHERE endpointId = ?
  `);

  const keys = stmt.all(endpointId) as any[];
  const bcrypt = await import('bcryptjs');

  for (const apiKey of keys) {
    if (!apiKey.enabled) continue;

    // Check expiration
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      continue;
    }

    // Verify key hash
    const isValid = await bcrypt.compare(key, apiKey.keyHash);
    if (isValid) {
      // Update last used timestamp
      db.prepare('UPDATE api_keys SET lastUsedAt = ? WHERE keyHash = ?')
        .run(new Date().toISOString(), apiKey.keyHash);
      return true;
    }
  }

  return false;
}

export async function deleteApiKey(id: string): Promise<boolean> {
  const db = await getDB();
  const stmt = db.prepare('DELETE FROM api_keys WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export async function toggleApiKey(id: string, enabled: boolean): Promise<boolean> {
  const db = await getDB();
  const stmt = db.prepare('UPDATE api_keys SET enabled = ? WHERE id = ?');
  const result = stmt.run(enabled ? 1 : 0, id);
  return result.changes > 0;
}
```

#### Step 2: Update API Endpoint Handler
```typescript
// src/app/api/custom/[endpointName]/route.ts

// Add at the beginning of POST handler
const endpoint = await getApiEndpointByName(params.endpointName);

if (endpoint.requireApiKey) {
  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key required' },
      { status: 401 }
    );
  }

  const isValid = await verifyApiKey(endpoint.id, apiKey);

  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 401 }
    );
  }
}
```

### Frontend Implementation

#### Step 3: Create API Keys Management Component
```typescript
// src/components/api-keys-manager.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Key, Copy, Trash2, Plus } from 'lucide-react';

interface ApiKeysManagerProps {
  endpointId: string;
}

export function ApiKeysManager({ endpointId }: ApiKeysManagerProps) {
  const [keys, setKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [showNewKey, setShowNewKey] = useState(false);
  const [generatedKey, setGeneratedKey] = useState('');

  const createKey = async () => {
    const response = await fetch(`/api/endpoints/${endpointId}/api-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName })
    });

    const data = await response.json();
    setGeneratedKey(data.key);
    setShowNewKey(true);
    loadKeys();
  };

  const deleteKey = async (id: string) => {
    await fetch(`/api/endpoints/${endpointId}/api-keys/${id}`, {
      method: 'DELETE'
    });
    loadKeys();
  };

  const toggleKey = async (id: string, enabled: boolean) => {
    await fetch(`/api/endpoints/${endpointId}/api-keys/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    loadKeys();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          API Keys
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New Key Form */}
        <div className="flex gap-2">
          <Input
            placeholder="Key name..."
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
          />
          <Button onClick={createKey}>
            <Plus className="h-4 w-4 mr-2" />
            Generate Key
          </Button>
        </div>

        {/* Show generated key once */}
        {showNewKey && (
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="pt-6">
              <p className="text-sm font-medium mb-2">⚠️ Save this key now - it won't be shown again!</p>
              <div className="flex gap-2">
                <Input value={generatedKey} readOnly />
                <Button
                  onClick={() => navigator.clipboard.writeText(generatedKey)}
                  variant="outline"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Keys List */}
        <div className="space-y-2">
          {keys.map((key: any) => (
            <Card key={key.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium">{key.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Created: {new Date(key.createdAt).toLocaleDateString()}
                    {key.lastUsedAt && ` • Last used: ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={key.enabled}
                    onCheckedChange={(enabled) => toggleKey(key.id, enabled)}
                  />
                  <Badge variant={key.enabled ? 'default' : 'secondary'}>
                    {key.enabled ? 'Active' : 'Disabled'}
                  </Badge>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => deleteKey(key.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

#### Step 4: Add API Routes
```typescript
// src/app/api/endpoints/[id]/api-keys/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createApiKey, getApiKeysByEndpoint } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const keys = await getApiKeysByEndpoint(id);

  // Don't return key hashes
  return NextResponse.json(
    keys.map(k => ({ ...k, keyHash: undefined }))
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name, expiresAt } = await request.json();

  const { key, apiKey } = await createApiKey(id, name, expiresAt);

  return NextResponse.json({ key, apiKey: { ...apiKey, keyHash: undefined } });
}
```

---

## 2. Webhook Testing Interface

**Effort:** 3-4 hours
**Priority:** Very High
**Dependencies:** None

### Frontend Implementation

#### Step 1: Create Webhook Tester Component
```typescript
// src/components/webhook-tester.tsx

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Send, Save, Upload } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function WebhookTester() {
  const [payload, setPayload] = useState('<?xml version="1.0"?>\\n<notification>\\n  <title>Test Notification</title>\\n  <message>This is a test</message>\\n</notification>');
  const [selectedIntegration, setSelectedIntegration] = useState('');
  const [selectedEndpoint, setSelectedEndpoint] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState([]);

  const sendTest = async () => {
    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch(`/api/test/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload,
          integrationId: selectedIntegration,
          endpointId: selectedEndpoint
        })
      });

      const data = await res.json();
      setResponse({
        status: res.status,
        data,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      setResponse({
        status: 500,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async () => {
    const name = prompt('Template name:');
    if (!name) return;

    await fetch('/api/test/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, payload })
    });

    loadTemplates();
  };

  const loadTemplate = (template: any) => {
    setPayload(template.payload);
  };

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Webhook Tester</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="compose">
          <TabsList>
            <TabsTrigger value="compose">Compose</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="examples">Examples</TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-4">
            {/* Target Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Integration</label>
                <Select value={selectedIntegration} onValueChange={setSelectedIntegration}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select integration..." />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Load integrations */}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Endpoint</label>
                <Select value={selectedEndpoint} onValueChange={setSelectedEndpoint}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select endpoint..." />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Load endpoints */}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Payload Editor */}
            <div>
              <label className="text-sm font-medium mb-2 block">Payload</label>
              <Textarea
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                className="font-mono text-sm min-h-[300px]"
                placeholder="Enter XML or JSON payload..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={sendTest} disabled={loading}>
                <Send className="h-4 w-4 mr-2" />
                {loading ? 'Sending...' : 'Send Test'}
              </Button>
              <Button variant="outline" onClick={saveTemplate}>
                <Save className="h-4 w-4 mr-2" />
                Save as Template
              </Button>
            </div>

            {/* Response */}
            {response && (
              <Card className={response.status >= 200 && response.status < 300 ? 'border-green-500' : 'border-red-500'}>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    Response
                    <Badge variant={response.status >= 200 && response.status < 300 ? 'default' : 'destructive'}>
                      {response.status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-[400px]">
                    {JSON.stringify(response.data || response.error, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="templates">
            <div className="space-y-2">
              {savedTemplates.map((template: any) => (
                <Card key={template.id} className="cursor-pointer hover:bg-accent/5" onClick={() => loadTemplate(template)}>
                  <CardContent className="py-4">
                    <p className="font-medium">{template.name}</p>
                    <p className="text-sm text-muted-foreground">Created: {new Date(template.createdAt).toLocaleDateString()}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="examples">
            {/* Predefined examples */}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
```

#### Step 2: Add Test API Route
```typescript
// src/app/api/test/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationById } from '@/lib/db';

export async function POST(request: NextRequest) {
  const { payload, integrationId, endpointId } = await request.json();

  if (!integrationId && !endpointId) {
    return NextResponse.json(
      { error: 'Must specify integration or endpoint' },
      { status: 400 }
    );
  }

  // Process the test webhook
  // This simulates the full webhook flow without actually hitting external URLs

  try {
    const integration = await getIntegrationById(integrationId);

    // Process through field filters, transformations, etc.
    // Return the result without sending to external webhook

    return NextResponse.json({
      success: true,
      processed: {
        // Show what would be sent
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

---

## 3. Webhook Signature Verification (HMAC)

**Effort:** 2-3 hours
**Priority:** High
**Dependencies:** Migration 018 (completed)

### Backend Implementation

#### Step 1: Add Signing Function
```typescript
// src/lib/webhook-signing.ts

import crypto from 'crypto';

export function generateWebhookSignature(
  payload: string,
  secret: string,
  algorithm: string = 'sha256'
): string {
  const hmac = crypto.createHmac(algorithm, secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm: string = 'sha256'
): boolean {
  const expectedSignature = generateWebhookSignature(payload, secret, algorithm);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

#### Step 2: Update Webhook Delivery
```typescript
// In src/app/api/custom/[endpointName]/route.ts
// When sending webhooks to integrations:

if (integration.signWebhooks && integration.signingSecret) {
  const signature = generateWebhookSignature(
    JSON.stringify(transformedPayload),
    integration.signingSecret
  );

  headers['X-NCRelay-Signature'] = `sha256=${signature}`;
  headers['X-NCRelay-Timestamp'] = Date.now().toString();
}
```

### Frontend Implementation

#### Step 3: Add Signing Settings to Integration Form
```typescript
// Add to integration edit form
<div className="space-y-2">
  <Switch
    checked={formData.signWebhooks}
    onCheckedChange={(checked) => setFormData({ ...formData, signWebhooks: checked })}
  />
  <Label>Sign outgoing webhooks</Label>

  {formData.signWebhooks && (
    <Input
      type="password"
      placeholder="Signing secret..."
      value={formData.signingSecret}
      onChange={(e) => setFormData({ ...formData, signingSecret: e.target.value })}
    />
  )}

  <p className="text-sm text-muted-foreground">
    Recipients can verify webhook authenticity using the X-NCRelay-Signature header
  </p>
</div>
```

---

*[Continue with remaining 13 features...]*

Due to length constraints, I'll create this as a comprehensive document. Should I continue with the remaining features in this same file, or would you prefer I create separate, focused documents for each feature category?

Let me know and I'll complete the full implementation guide!
