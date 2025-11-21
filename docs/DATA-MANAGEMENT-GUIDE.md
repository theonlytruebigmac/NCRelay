# Data Management Implementation Guide

This guide covers implementing advanced data management features for configuration and notification templates.

## Features Covered

1. **Notification Templates & Transformations** - Handlebars templates for custom notification formatting
2. **Export/Import Configuration** - Backup and restore system configuration

---

## Feature 9: Notification Templates & Transformations

### Overview
Allow users to create reusable templates for notification formatting using Handlebars. Templates can transform incoming webhook data into custom formats for different platforms.

**Effort Estimate**: 10-12 hours

### Database Schema

Already included in migration 018:
- `notification_templates` table
- `integrations.templateId` column for linking templates

### Step 1: Install Template Engine

```bash
npm install handlebars
npm install -D @types/handlebars
```

### Step 2: Create Template Engine Service

**File**: `src/lib/template-engine.ts`

```typescript
import Handlebars from 'handlebars';
import { logger } from './logger';

/**
 * Register custom Handlebars helpers
 */
export function registerTemplateHelpers(): void {
  // Date formatting helper
  Handlebars.registerHelper('formatDate', function(date: string, format: string) {
    if (!date) return '';
    const d = new Date(date);

    if (format === 'short') {
      return d.toLocaleDateString();
    } else if (format === 'long') {
      return d.toLocaleString();
    } else if (format === 'iso') {
      return d.toISOString();
    }
    return d.toString();
  });

  // JSON stringify helper
  Handlebars.registerHelper('json', function(context) {
    return JSON.stringify(context, null, 2);
  });

  // Uppercase helper
  Handlebars.registerHelper('upper', function(str: string) {
    return str ? str.toUpperCase() : '';
  });

  // Lowercase helper
  Handlebars.registerHelper('lower', function(str: string) {
    return str ? str.toLowerCase() : '';
  });

  // Truncate helper
  Handlebars.registerHelper('truncate', function(str: string, length: number) {
    if (!str) return '';
    return str.length > length ? str.substring(0, length) + '...' : str;
  });

  // Default value helper
  Handlebars.registerHelper('default', function(value, defaultValue) {
    return value || defaultValue;
  });

  // Conditional equality helper
  Handlebars.registerHelper('eq', function(a, b) {
    return a === b;
  });

  // Array join helper
  Handlebars.registerHelper('join', function(array: any[], separator: string) {
    if (!Array.isArray(array)) return '';
    return array.join(separator || ', ');
  });

  logger.info('Template helpers registered');
}

/**
 * Compile and execute a Handlebars template
 */
export function renderTemplate(templateString: string, data: any): string {
  try {
    const template = Handlebars.compile(templateString);
    return template(data);
  } catch (error) {
    logger.error('Template rendering failed', { error, templateString });
    throw new Error(`Template rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate template syntax without executing
 */
export function validateTemplate(templateString: string): { valid: boolean; error?: string } {
  try {
    Handlebars.compile(templateString);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown syntax error'
    };
  }
}

/**
 * Get available template variables from data object
 */
export function extractTemplateVariables(data: any, prefix = ''): string[] {
  const variables: string[] = [];

  if (!data || typeof data !== 'object') return variables;

  for (const [key, value] of Object.entries(data)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    variables.push(fullKey);

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      variables.push(...extractTemplateVariables(value, fullKey));
    }
  }

  return variables;
}

// Initialize helpers on module load
registerTemplateHelpers();
```

### Step 3: Create Template Database Functions

**File**: `src/lib/db.ts` (add these functions)

```typescript
import { v4 as uuidv4 } from 'uuid';

export interface NotificationTemplate {
  id: string;
  name: string;
  description?: string;
  template: string;
  engine: 'handlebars';
  createdAt: string;
  updatedAt: string;
}

/**
 * Get all notification templates
 */
export async function getNotificationTemplates(): Promise<NotificationTemplate[]> {
  const db = await getDB();
  return db.prepare('SELECT * FROM notification_templates ORDER BY name').all() as NotificationTemplate[];
}

/**
 * Get template by ID
 */
export async function getNotificationTemplateById(id: string): Promise<NotificationTemplate | null> {
  const db = await getDB();
  return db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(id) as NotificationTemplate | null;
}

/**
 * Create new template
 */
export async function createNotificationTemplate(
  template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<NotificationTemplate> {
  const db = await getDB();

  const newTemplate: NotificationTemplate = {
    id: uuidv4(),
    ...template,
    engine: 'handlebars',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.prepare(`
    INSERT INTO notification_templates (id, name, description, template, engine, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    newTemplate.id,
    newTemplate.name,
    newTemplate.description || null,
    newTemplate.template,
    newTemplate.engine,
    newTemplate.createdAt,
    newTemplate.updatedAt
  );

  return newTemplate;
}

/**
 * Update template
 */
export async function updateNotificationTemplate(
  id: string,
  updates: Partial<Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<NotificationTemplate | null> {
  const db = await getDB();

  const existing = await getNotificationTemplateById(id);
  if (!existing) return null;

  const updated: NotificationTemplate = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  db.prepare(`
    UPDATE notification_templates
    SET name = ?, description = ?, template = ?, updatedAt = ?
    WHERE id = ?
  `).run(
    updated.name,
    updated.description || null,
    updated.template,
    updated.updatedAt,
    id
  );

  return updated;
}

/**
 * Delete template
 */
export async function deleteNotificationTemplate(id: string): Promise<boolean> {
  const db = await getDB();

  // Check if template is in use
  const inUse = db.prepare(
    'SELECT COUNT(*) as count FROM integrations WHERE templateId = ?'
  ).get(id) as { count: number };

  if (inUse.count > 0) {
    throw new Error(`Cannot delete template: used by ${inUse.count} integration(s)`);
  }

  const result = db.prepare('DELETE FROM notification_templates WHERE id = ?').run(id);
  return result.changes > 0;
}
```

### Step 4: Create Template API Routes

**File**: `src/app/api/templates/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import {
  getNotificationTemplates,
  createNotificationTemplate
} from '@/lib/db';
import { validateTemplate } from '@/lib/template-engine';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = await getNotificationTemplates();
    return NextResponse.json(templates);
  } catch (error) {
    logger.error('Failed to fetch templates', { error });
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, template } = body;

    // Validate input
    if (!name || !template) {
      return NextResponse.json(
        { error: 'Name and template are required' },
        { status: 400 }
      );
    }

    // Validate template syntax
    const validation = validateTemplate(template);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid template syntax', details: validation.error },
        { status: 400 }
      );
    }

    const newTemplate = await createNotificationTemplate({
      name,
      description,
      template,
      engine: 'handlebars'
    });

    logger.info('Template created', { templateId: newTemplate.id, userId: user.id });

    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error) {
    logger.error('Failed to create template', { error });
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
```

**File**: `src/app/api/templates/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import {
  getNotificationTemplateById,
  updateNotificationTemplate,
  deleteNotificationTemplate
} from '@/lib/db';
import { validateTemplate } from '@/lib/template-engine';
import { logger } from '@/lib/logger';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const template = await getNotificationTemplateById(params.id);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    logger.error('Failed to fetch template', { error, templateId: params.id });
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, template } = body;

    // Validate template syntax if provided
    if (template) {
      const validation = validateTemplate(template);
      if (!validation.valid) {
        return NextResponse.json(
          { error: 'Invalid template syntax', details: validation.error },
          { status: 400 }
        );
      }
    }

    const updated = await updateNotificationTemplate(params.id, {
      name,
      description,
      template
    });

    if (!updated) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    logger.info('Template updated', { templateId: params.id, userId: user.id });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Failed to update template', { error, templateId: params.id });
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await deleteNotificationTemplate(params.id);

    logger.info('Template deleted', { templateId: params.id, userId: user.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete template', { error, templateId: params.id });

    if (error instanceof Error && error.message.includes('in use')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
```

**File**: `src/app/api/templates/[id]/test/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getNotificationTemplateById } from '@/lib/db';
import { renderTemplate, extractTemplateVariables } from '@/lib/template-engine';
import { logger } from '@/lib/logger';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const template = await getNotificationTemplateById(params.id);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const body = await req.json();
    const { testData } = body;

    if (!testData) {
      return NextResponse.json(
        { error: 'Test data is required' },
        { status: 400 }
      );
    }

    // Render template with test data
    const result = renderTemplate(template.template, testData);

    // Extract available variables
    const availableVariables = extractTemplateVariables(testData);

    return NextResponse.json({
      result,
      availableVariables,
      template: template.template
    });
  } catch (error) {
    logger.error('Template test failed', { error, templateId: params.id });
    return NextResponse.json(
      { error: 'Template test failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    );
  }
}
```

### Step 5: Create Template Management UI

**File**: `src/app/(dashboard)/templates/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, TestTube } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Template {
  id: string;
  name: string;
  description?: string;
  template: string;
  engine: string;
  createdAt: string;
  updatedAt: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    template: ''
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    try {
      const res = await fetch('/api/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch templates',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const url = editingTemplate
        ? `/api/templates/${editingTemplate.id}`
        : '/api/templates';

      const method = editingTemplate ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save template');
      }

      toast({
        title: 'Success',
        description: `Template ${editingTemplate ? 'updated' : 'created'} successfully`
      });

      setDialogOpen(false);
      setFormData({ name: '', description: '', template: '' });
      setEditingTemplate(null);
      fetchTemplates();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save template',
        variant: 'destructive'
      });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete template');
      }

      toast({
        title: 'Success',
        description: 'Template deleted successfully'
      });

      fetchTemplates();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete template',
        variant: 'destructive'
      });
    }
  }

  function openEditDialog(template: Template) {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      template: template.template
    });
    setDialogOpen(true);
  }

  function openCreateDialog() {
    setEditingTemplate(null);
    setFormData({ name: '', description: '', template: '' });
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Notification Templates</h1>
          <p className="text-muted-foreground">
            Create reusable templates for notification formatting
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Edit Template' : 'Create Template'}
              </DialogTitle>
              <DialogDescription>
                Use Handlebars syntax for dynamic content. Available helpers: formatDate, json, upper, lower, truncate, default, eq, join
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="template">Template *</Label>
                <Textarea
                  id="template"
                  value={formData.template}
                  onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                  className="font-mono text-sm min-h-[300px]"
                  placeholder={`Example:\nAlert: {{alertmessage}}\nDevice: {{devicename}}\nTime: {{formatDate timestamp 'long'}}`}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingTemplate ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading templates...</div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No templates yet. Create your first template to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{template.name}</CardTitle>
                    {template.description && (
                      <CardDescription>{template.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(template)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                  {template.template}
                </pre>
                <div className="mt-2 text-xs text-muted-foreground">
                  Updated: {new Date(template.updatedAt).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Step 6: Integrate Templates with Notifications

**Update**: `src/app/api/webhook/[slug]/route.ts`

```typescript
import { renderTemplate } from '@/lib/template-engine';
import { getNotificationTemplateById } from '@/lib/db';

// In your webhook processing logic:
async function processWebhook(data: any, integration: Integration) {
  let payload = data;

  // If integration has a template, apply it
  if (integration.templateId) {
    const template = await getNotificationTemplateById(integration.templateId);
    if (template) {
      try {
        const rendered = renderTemplate(template.template, data);
        // For JSON templates, parse the result
        if (integration.platform !== 'webhook') {
          payload = JSON.parse(rendered);
        } else {
          payload = rendered;
        }
      } catch (error) {
        logger.error('Template rendering failed', {
          templateId: integration.templateId,
          error
        });
        // Fall back to original data
      }
    }
  }

  // Continue with delivery...
}
```

---

## Feature 10: Export/Import Configuration

### Overview
Allow users to export their entire configuration (endpoints, integrations, templates, etc.) as JSON and import it on another instance or for backup purposes.

**Effort Estimate**: 6-8 hours

### Step 1: Create Export/Import Service

**File**: `src/lib/config-export.ts`

```typescript
import { getDB } from './db';
import { logger } from './logger';
import { encrypt, decrypt } from './crypto';

export interface ExportedConfig {
  version: string;
  exportedAt: string;
  exportedBy: string;
  data: {
    endpoints: any[];
    integrations: any[];
    templates: any[];
    fieldFilters: any[];
    alertSettings: any[];
  };
}

/**
 * Export all configuration data
 */
export async function exportConfiguration(userId: string): Promise<ExportedConfig> {
  const db = await getDB();

  logger.info('Exporting configuration', { userId });

  // Get all endpoints
  const endpoints = db.prepare(`
    SELECT id, name, slug, description, enabled, requireApiKey, tags, createdAt, userId
    FROM api_endpoints
  `).all();

  // Get all integrations (decrypt sensitive data for export)
  const integrations = db.prepare(`
    SELECT
      id, name, platform, apiEndpointId, config, enabled,
      signingSecret, signWebhooks, maxConcurrency, templateId, tags, userId, createdAt
    FROM integrations
  `).all();

  // Decrypt integration configs
  const decryptedIntegrations = await Promise.all(
    integrations.map(async (integration: any) => {
      try {
        const decryptedConfig = await decrypt(integration.config);
        return {
          ...integration,
          config: JSON.parse(decryptedConfig)
        };
      } catch (error) {
        logger.error('Failed to decrypt integration config during export', {
          integrationId: integration.id
        });
        return integration;
      }
    })
  );

  // Get all templates
  const templates = db.prepare(`
    SELECT id, name, description, template, engine, createdAt, updatedAt
    FROM notification_templates
  `).all();

  // Get all field filters
  const fieldFilters = db.prepare(`
    SELECT id, name, config, createdAt, updatedAt
    FROM field_filters
  `).all();

  // Get alert settings
  const alertSettings = db.prepare(`
    SELECT id, type, enabled, threshold, recipients, createdAt, updatedAt
    FROM alert_settings
  `).all();

  const config: ExportedConfig = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    exportedBy: userId,
    data: {
      endpoints,
      integrations: decryptedIntegrations,
      templates,
      fieldFilters,
      alertSettings
    }
  };

  logger.info('Configuration exported successfully', {
    userId,
    counts: {
      endpoints: endpoints.length,
      integrations: integrations.length,
      templates: templates.length
    }
  });

  return config;
}

/**
 * Import configuration data
 */
export async function importConfiguration(
  config: ExportedConfig,
  userId: string,
  options: {
    overwrite?: boolean;
    skipExisting?: boolean;
  } = {}
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const db = await getDB();
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  logger.info('Importing configuration', { userId, options });

  // Start transaction
  db.exec('BEGIN TRANSACTION');

  try {
    // Import templates first (no dependencies)
    for (const template of config.data.templates) {
      try {
        const existing = db.prepare('SELECT id FROM notification_templates WHERE id = ?').get(template.id);

        if (existing && !options.overwrite) {
          if (options.skipExisting) {
            skipped++;
            continue;
          } else {
            errors.push(`Template ${template.name} already exists`);
            continue;
          }
        }

        if (existing && options.overwrite) {
          db.prepare(`
            UPDATE notification_templates
            SET name = ?, description = ?, template = ?, engine = ?, updatedAt = ?
            WHERE id = ?
          `).run(
            template.name,
            template.description,
            template.template,
            template.engine,
            new Date().toISOString(),
            template.id
          );
        } else {
          db.prepare(`
            INSERT INTO notification_templates (id, name, description, template, engine, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            template.id,
            template.name,
            template.description,
            template.template,
            template.engine,
            template.createdAt,
            template.updatedAt
          );
        }

        imported++;
      } catch (error) {
        errors.push(`Failed to import template ${template.name}: ${error}`);
      }
    }

    // Import endpoints
    for (const endpoint of config.data.endpoints) {
      try {
        const existing = db.prepare('SELECT id FROM api_endpoints WHERE id = ?').get(endpoint.id);

        if (existing && !options.overwrite) {
          if (options.skipExisting) {
            skipped++;
            continue;
          } else {
            errors.push(`Endpoint ${endpoint.name} already exists`);
            continue;
          }
        }

        if (existing && options.overwrite) {
          db.prepare(`
            UPDATE api_endpoints
            SET name = ?, slug = ?, description = ?, enabled = ?, requireApiKey = ?, tags = ?, userId = ?
            WHERE id = ?
          `).run(
            endpoint.name,
            endpoint.slug,
            endpoint.description,
            endpoint.enabled,
            endpoint.requireApiKey,
            endpoint.tags,
            userId, // Assign to current user
            endpoint.id
          );
        } else {
          db.prepare(`
            INSERT INTO api_endpoints (id, name, slug, description, enabled, requireApiKey, tags, createdAt, userId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            endpoint.id,
            endpoint.name,
            endpoint.slug,
            endpoint.description,
            endpoint.enabled,
            endpoint.requireApiKey,
            endpoint.tags,
            endpoint.createdAt,
            userId
          );
        }

        imported++;
      } catch (error) {
        errors.push(`Failed to import endpoint ${endpoint.name}: ${error}`);
      }
    }

    // Import integrations (re-encrypt configs)
    for (const integration of config.data.integrations) {
      try {
        const existing = db.prepare('SELECT id FROM integrations WHERE id = ?').get(integration.id);

        // Check if referenced endpoint exists
        const endpointExists = db.prepare('SELECT id FROM api_endpoints WHERE id = ?').get(integration.apiEndpointId);
        if (!endpointExists) {
          errors.push(`Integration ${integration.name} references non-existent endpoint`);
          continue;
        }

        if (existing && !options.overwrite) {
          if (options.skipExisting) {
            skipped++;
            continue;
          } else {
            errors.push(`Integration ${integration.name} already exists`);
            continue;
          }
        }

        // Re-encrypt config
        const encryptedConfig = await encrypt(JSON.stringify(integration.config));

        if (existing && options.overwrite) {
          db.prepare(`
            UPDATE integrations
            SET name = ?, platform = ?, apiEndpointId = ?, config = ?, enabled = ?,
                signingSecret = ?, signWebhooks = ?, maxConcurrency = ?, templateId = ?, tags = ?, userId = ?
            WHERE id = ?
          `).run(
            integration.name,
            integration.platform,
            integration.apiEndpointId,
            encryptedConfig,
            integration.enabled,
            integration.signingSecret,
            integration.signWebhooks,
            integration.maxConcurrency,
            integration.templateId,
            integration.tags,
            userId,
            integration.id
          );
        } else {
          db.prepare(`
            INSERT INTO integrations (id, name, platform, apiEndpointId, config, enabled, signingSecret, signWebhooks, maxConcurrency, templateId, tags, createdAt, userId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            integration.id,
            integration.name,
            integration.platform,
            integration.apiEndpointId,
            encryptedConfig,
            integration.enabled,
            integration.signingSecret,
            integration.signWebhooks,
            integration.maxConcurrency,
            integration.templateId,
            integration.tags,
            integration.createdAt,
            userId
          );
        }

        imported++;
      } catch (error) {
        errors.push(`Failed to import integration ${integration.name}: ${error}`);
      }
    }

    // Commit transaction
    db.exec('COMMIT');

    logger.info('Configuration imported successfully', {
      userId,
      imported,
      skipped,
      errorCount: errors.length
    });

    return { imported, skipped, errors };
  } catch (error) {
    // Rollback on any error
    db.exec('ROLLBACK');
    logger.error('Configuration import failed', { error });
    throw error;
  }
}

/**
 * Validate imported configuration
 */
export function validateImportConfig(config: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.version) {
    errors.push('Missing version field');
  }

  if (!config.data) {
    errors.push('Missing data field');
  }

  if (config.data) {
    if (!Array.isArray(config.data.endpoints)) {
      errors.push('endpoints must be an array');
    }
    if (!Array.isArray(config.data.integrations)) {
      errors.push('integrations must be an array');
    }
    if (!Array.isArray(config.data.templates)) {
      errors.push('templates must be an array');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

### Step 2: Create Export/Import API Routes

**File**: `src/app/api/config/export/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { exportConfiguration } from '@/lib/config-export';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await exportConfiguration(user.id);

    // Return as downloadable JSON file
    return new NextResponse(JSON.stringify(config, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="ncrelay-config-${Date.now()}.json"`
      }
    });
  } catch (error) {
    logger.error('Configuration export failed', { error });
    return NextResponse.json(
      { error: 'Failed to export configuration' },
      { status: 500 }
    );
  }
}
```

**File**: `src/app/api/config/import/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { importConfiguration, validateImportConfig } from '@/lib/config-export';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { config, options } = body;

    // Validate config structure
    const validation = validateImportConfig(config);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid configuration', details: validation.errors },
        { status: 400 }
      );
    }

    // Import configuration
    const result = await importConfiguration(config, user.id, options);

    if (result.errors.length > 0) {
      logger.warn('Configuration import completed with errors', {
        userId: user.id,
        errors: result.errors
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Configuration import failed', { error });
    return NextResponse.json(
      { error: 'Failed to import configuration' },
      { status: 500 }
    );
  }
}
```

### Step 3: Create Import/Export UI

**File**: `src/app/(dashboard)/settings/import-export/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Upload, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ImportExportPage() {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importOptions, setImportOptions] = useState({
    overwrite: false,
    skipExisting: true
  });
  const { toast } = useToast();

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch('/api/config/export');
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ncrelay-config-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Success',
        description: 'Configuration exported successfully'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export configuration',
        variant: 'destructive'
      });
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const config = JSON.parse(text);

      const res = await fetch('/api/config/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, options: importOptions })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Import failed');
      }

      const result = await res.json();

      toast({
        title: 'Import Complete',
        description: `Imported: ${result.imported}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`
      });

      if (result.errors.length > 0) {
        console.error('Import errors:', result.errors);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to import configuration',
        variant: 'destructive'
      });
    } finally {
      setImporting(false);
      e.target.value = ''; // Reset file input
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import & Export</h1>
        <p className="text-muted-foreground">
          Backup and restore your configuration
        </p>
      </div>

      {/* Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Configuration
          </CardTitle>
          <CardDescription>
            Download your complete configuration as JSON (endpoints, integrations, templates)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export Configuration'}
          </Button>
        </CardContent>
      </Card>

      {/* Import */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Configuration
          </CardTitle>
          <CardDescription>
            Restore configuration from a previously exported JSON file
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Warning:</strong> Importing configuration will modify your database.
              Make sure to export your current configuration first as a backup.
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="skipExisting"
                checked={importOptions.skipExisting}
                onCheckedChange={(checked) =>
                  setImportOptions({ ...importOptions, skipExisting: checked as boolean })
                }
              />
              <Label htmlFor="skipExisting">
                Skip existing items (don't import duplicates)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="overwrite"
                checked={importOptions.overwrite}
                onCheckedChange={(checked) =>
                  setImportOptions({ ...importOptions, overwrite: checked as boolean })
                }
              />
              <Label htmlFor="overwrite">
                Overwrite existing items with imported data
              </Label>
            </div>
          </div>

          <div>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              disabled={importing}
              className="hidden"
              id="import-file"
            />
            <Button asChild disabled={importing}>
              <label htmlFor="import-file" className="cursor-pointer">
                {importing ? 'Importing...' : 'Select File to Import'}
              </label>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Testing the Data Management Features

### Test Templates

1. Create a new template:
   ```json
   {
     "name": "Slack Alert Template",
     "description": "Format alerts for Slack",
     "template": "{\n  \"text\": \"Alert from {{devicename}}\",\n  \"blocks\": [\n    {\n      \"type\": \"section\",\n      \"text\": {\n        \"type\": \"mrkdwn\",\n        \"text\": \"*{{alertmessage}}*\\n{{formatDate timestamp 'long'}}\"\n      }\n    }\n  ]\n}"
   }
   ```

2. Test the template with sample data
3. Assign template to an integration
4. Send test webhook and verify formatted output

### Test Export/Import

1. Export your configuration
2. Modify some values in the JSON
3. Import to a test instance
4. Verify all data imported correctly

