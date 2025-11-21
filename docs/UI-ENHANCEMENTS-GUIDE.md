# UI Enhancements Implementation Guide

This guide covers implementing advanced UI features for better user experience and productivity.

## Features Covered

1. **Enhanced Dark Mode** - System preference detection with per-user settings
2. **Bulk Operations UI** - Multi-select and batch actions for endpoints and integrations
3. **Advanced Search & Filtering** - Full-text search with saved filter presets

---

## Feature 11: Enhanced Dark Mode with User Preferences

### Overview
Improve dark mode with automatic system preference detection, smooth transitions, and per-user preferences stored in the database.

**Effort Estimate**: 4-6 hours

### Database Schema

Already included in migration 018:
- `user_preferences` table with `theme` column

### Step 1: Create Theme Preference Service

**File**: `src/lib/theme-preferences.ts`

```typescript
import { getDB } from './db';

export type Theme = 'light' | 'dark' | 'system';

export interface UserPreferences {
  userId: string;
  theme: Theme;
  dashboardRefreshInterval: number;
  notificationsEnabled: boolean;
  preferences: Record<string, any>;
}

/**
 * Get user theme preference
 */
export async function getUserTheme(userId: string): Promise<Theme> {
  const db = await getDB();

  const result = db.prepare(
    'SELECT theme FROM user_preferences WHERE userId = ?'
  ).get(userId) as { theme: Theme } | undefined;

  return result?.theme || 'system';
}

/**
 * Set user theme preference
 */
export async function setUserTheme(userId: string, theme: Theme): Promise<void> {
  const db = await getDB();

  // Check if preferences exist
  const existing = db.prepare(
    'SELECT userId FROM user_preferences WHERE userId = ?'
  ).get(userId);

  if (existing) {
    db.prepare('UPDATE user_preferences SET theme = ? WHERE userId = ?')
      .run(theme, userId);
  } else {
    db.prepare(`
      INSERT INTO user_preferences (userId, theme, dashboardRefreshInterval, notificationsEnabled)
      VALUES (?, ?, ?, ?)
    `).run(userId, theme, 30000, 1);
  }
}

/**
 * Get all user preferences
 */
export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  const db = await getDB();

  const result = db.prepare(
    'SELECT * FROM user_preferences WHERE userId = ?'
  ).get(userId) as any;

  if (!result) return null;

  return {
    userId: result.userId,
    theme: result.theme || 'system',
    dashboardRefreshInterval: result.dashboardRefreshInterval || 30000,
    notificationsEnabled: result.notificationsEnabled === 1,
    preferences: result.preferences ? JSON.parse(result.preferences) : {}
  };
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(
  userId: string,
  updates: Partial<Omit<UserPreferences, 'userId'>>
): Promise<void> {
  const db = await getDB();

  const existing = await getUserPreferences(userId);

  if (!existing) {
    // Create new preferences
    db.prepare(`
      INSERT INTO user_preferences (userId, theme, dashboardRefreshInterval, notificationsEnabled, preferences)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      userId,
      updates.theme || 'system',
      updates.dashboardRefreshInterval || 30000,
      updates.notificationsEnabled ? 1 : 0,
      JSON.stringify(updates.preferences || {})
    );
  } else {
    // Update existing
    const merged = {
      ...existing,
      ...updates,
      preferences: {
        ...existing.preferences,
        ...updates.preferences
      }
    };

    db.prepare(`
      UPDATE user_preferences
      SET theme = ?, dashboardRefreshInterval = ?, notificationsEnabled = ?, preferences = ?
      WHERE userId = ?
    `).run(
      merged.theme,
      merged.dashboardRefreshInterval,
      merged.notificationsEnabled ? 1 : 0,
      JSON.stringify(merged.preferences),
      userId
    );
  }
}
```

### Step 2: Create Preferences API Routes

**File**: `src/app/api/preferences/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getUserPreferences, updateUserPreferences } from '@/lib/theme-preferences';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const preferences = await getUserPreferences(user.id);

    // Return default preferences if none exist
    if (!preferences) {
      return NextResponse.json({
        theme: 'system',
        dashboardRefreshInterval: 30000,
        notificationsEnabled: true,
        preferences: {}
      });
    }

    return NextResponse.json(preferences);
  } catch (error) {
    logger.error('Failed to fetch preferences', { error });
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    await updateUserPreferences(user.id, body);

    logger.info('User preferences updated', { userId: user.id });

    const updated = await getUserPreferences(user.id);
    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Failed to update preferences', { error });
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
```

### Step 3: Create Theme Provider Component

**File**: `src/components/theme-provider.tsx`

```typescript
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Theme } from '@/lib/theme-preferences';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
};

type ThemeContextType = {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children, defaultTheme = 'system' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  // Load theme from user preferences on mount
  useEffect(() => {
    loadThemePreference();
    setMounted(true);
  }, []);

  async function loadThemePreference() {
    try {
      const res = await fetch('/api/preferences');
      if (res.ok) {
        const prefs = await res.json();
        setThemeState(prefs.theme || 'system');
      }
    } catch (error) {
      console.error('Failed to load theme preference:', error);
    }
  }

  // Apply theme to document
  useEffect(() => {
    if (!mounted) return;

    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    let applied: 'light' | 'dark';

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      applied = systemTheme;
    } else {
      applied = theme;
    }

    root.classList.add(applied);
    setResolvedTheme(applied);

    // Store in localStorage as backup
    localStorage.setItem('theme', theme);
  }, [theme, mounted]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      const newTheme = e.matches ? 'dark' : 'light';
      root.classList.add(newTheme);
      setResolvedTheme(newTheme);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  async function setTheme(newTheme: Theme) {
    setThemeState(newTheme);

    // Save to backend
    try {
      await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: newTheme })
      });
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  }

  // Prevent flash of unstyled content
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
```

### Step 4: Create Theme Selector Component

**File**: `src/components/theme-selector.tsx`

```typescript
'use client';

import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from './theme-provider';

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
          {theme === 'light' && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark</span>
          {theme === 'dark' && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="mr-2 h-4 w-4" />
          <span>System</span>
          {theme === 'system' && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Step 5: Update Root Layout

**File**: `src/app/layout.tsx`

```typescript
import { ThemeProvider } from '@/components/theme-provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider defaultTheme="system">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### Step 6: Add Theme Selector to Navigation

**Update**: Your navigation component to include the ThemeSelector:

```typescript
import { ThemeSelector } from '@/components/theme-selector';

export function Navigation() {
  return (
    <nav>
      {/* ... existing nav items ... */}
      <ThemeSelector />
    </nav>
  );
}
```

---

## Feature 12: Bulk Operations UI

### Overview
Add multi-select capability to endpoint and integration lists with bulk actions (enable/disable/delete/tag).

**Effort Estimate**: 8-10 hours

### Step 1: Create Bulk Operations Hook

**File**: `src/hooks/use-bulk-selection.ts`

```typescript
import { useState, useCallback } from 'react';

export function useBulkSelection<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(item => item.id)));
    }
  }, [items, selectedIds.size]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  const selectedItems = items.filter(item => selectedIds.has(item.id));

  return {
    selectedIds,
    selectedItems,
    selectedCount: selectedIds.size,
    isSelected,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    isAllSelected: selectedIds.size === items.length && items.length > 0
  };
}
```

### Step 2: Create Bulk Actions API Routes

**File**: `src/app/api/endpoints/bulk/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, ids, data } = body;

    if (!action || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Action and IDs are required' },
        { status: 400 }
      );
    }

    const db = await getDB();
    const placeholders = ids.map(() => '?').join(',');
    let affected = 0;

    switch (action) {
      case 'enable':
        const enableResult = db.prepare(
          `UPDATE api_endpoints SET enabled = 1 WHERE id IN (${placeholders})`
        ).run(...ids);
        affected = enableResult.changes;
        break;

      case 'disable':
        const disableResult = db.prepare(
          `UPDATE api_endpoints SET enabled = 0 WHERE id IN (${placeholders})`
        ).run(...ids);
        affected = disableResult.changes;
        break;

      case 'delete':
        // Delete associated integrations first (cascade)
        db.prepare(
          `DELETE FROM integrations WHERE apiEndpointId IN (${placeholders})`
        ).run(...ids);

        const deleteResult = db.prepare(
          `DELETE FROM api_endpoints WHERE id IN (${placeholders})`
        ).run(...ids);
        affected = deleteResult.changes;
        break;

      case 'tag':
        if (!data?.tags) {
          return NextResponse.json(
            { error: 'Tags are required for tag action' },
            { status: 400 }
          );
        }

        const tagResult = db.prepare(
          `UPDATE api_endpoints SET tags = ? WHERE id IN (${placeholders})`
        ).run(data.tags, ...ids);
        affected = tagResult.changes;
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    logger.info('Bulk action completed', {
      action,
      userId: user.id,
      count: ids.length,
      affected
    });

    return NextResponse.json({ success: true, affected });
  } catch (error) {
    logger.error('Bulk action failed', { error });
    return NextResponse.json(
      { error: 'Bulk action failed' },
      { status: 500 }
    );
  }
}
```

**File**: `src/app/api/integrations/bulk/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, ids, data } = body;

    if (!action || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Action and IDs are required' },
        { status: 400 }
      );
    }

    const db = await getDB();
    const placeholders = ids.map(() => '?').join(',');
    let affected = 0;

    switch (action) {
      case 'enable':
        const enableResult = db.prepare(
          `UPDATE integrations SET enabled = 1 WHERE id IN (${placeholders})`
        ).run(...ids);
        affected = enableResult.changes;
        break;

      case 'disable':
        const disableResult = db.prepare(
          `UPDATE integrations SET enabled = 0 WHERE id IN (${placeholders})`
        ).run(...ids);
        affected = disableResult.changes;
        break;

      case 'delete':
        const deleteResult = db.prepare(
          `DELETE FROM integrations WHERE id IN (${placeholders})`
        ).run(...ids);
        affected = deleteResult.changes;
        break;

      case 'tag':
        if (!data?.tags) {
          return NextResponse.json(
            { error: 'Tags are required for tag action' },
            { status: 400 }
          );
        }

        const tagResult = db.prepare(
          `UPDATE integrations SET tags = ? WHERE id IN (${placeholders})`
        ).run(data.tags, ...ids);
        affected = tagResult.changes;
        break;

      case 'set_template':
        if (!data?.templateId) {
          return NextResponse.json(
            { error: 'Template ID is required' },
            { status: 400 }
          );
        }

        const templateResult = db.prepare(
          `UPDATE integrations SET templateId = ? WHERE id IN (${placeholders})`
        ).run(data.templateId, ...ids);
        affected = templateResult.changes;
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    logger.info('Bulk action completed', {
      action,
      userId: user.id,
      count: ids.length,
      affected
    });

    return NextResponse.json({ success: true, affected });
  } catch (error) {
    logger.error('Bulk action failed', { error });
    return NextResponse.json(
      { error: 'Bulk action failed' },
      { status: 500 }
    );
  }
}
```

### Step 3: Update Endpoints Page with Bulk Selection

**File**: `src/app/(dashboard)/endpoints/page.tsx` (add bulk selection UI)

```typescript
'use client';

import { useState } from 'react';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, CheckSquare, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function EndpointsPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const selection = useBulkSelection(endpoints);
  const { toast } = useToast();

  async function handleBulkAction(action: string, data?: any) {
    try {
      const res = await fetch('/api/endpoints/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ids: Array.from(selection.selectedIds),
          data
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Bulk action failed');
      }

      const result = await res.json();

      toast({
        title: 'Success',
        description: `Updated ${result.affected} endpoint(s)`
      });

      selection.clearSelection();
      fetchEndpoints(); // Refresh list
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Bulk action failed',
        variant: 'destructive'
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* Bulk Actions Bar */}
      {selection.selectedCount > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" />
            <span className="font-medium">
              {selection.selectedCount} endpoint(s) selected
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkAction('enable')}
            >
              Enable
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkAction('disable')}
            >
              Disable
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm('Delete selected endpoints?')) {
                  handleBulkAction('delete');
                }
              }}
            >
              Delete
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={selection.clearSelection}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Table Header with Select All */}
      <div className="flex items-center gap-4 px-4 py-2 bg-muted/30 rounded-lg">
        <Checkbox
          checked={selection.isAllSelected}
          onCheckedChange={selection.toggleSelectAll}
        />
        <span className="font-semibold">Name</span>
        {/* ... other headers ... */}
      </div>

      {/* Endpoint List */}
      {endpoints.map(endpoint => (
        <div key={endpoint.id} className="flex items-center gap-4 p-4 border rounded-lg">
          <Checkbox
            checked={selection.isSelected(endpoint.id)}
            onCheckedChange={() => selection.toggleSelect(endpoint.id)}
          />
          <div className="flex-1">
            <h3 className="font-medium">{endpoint.name}</h3>
            <p className="text-sm text-muted-foreground">{endpoint.slug}</p>
          </div>
          {/* ... rest of endpoint display ... */}
        </div>
      ))}
    </div>
  );
}
```

---

## Feature 13: Advanced Search & Filtering

### Overview
Add full-text search across endpoints, integrations, and logs with saved filter presets and advanced filtering options.

**Effort Estimate**: 10-12 hours

### Step 1: Create Search Service

**File**: `src/lib/search.ts`

```typescript
import { getDB } from './db';

export interface SearchFilters {
  query?: string;
  platform?: string;
  enabled?: boolean;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  status?: string;
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Search endpoints with filters
 */
export async function searchEndpoints(
  filters: SearchFilters,
  page: number = 1,
  pageSize: number = 20
): Promise<SearchResult<any>> {
  const db = await getDB();
  const offset = (page - 1) * pageSize;

  let whereClauses: string[] = [];
  let params: any[] = [];

  // Text search
  if (filters.query) {
    whereClauses.push('(name LIKE ? OR slug LIKE ? OR description LIKE ?)');
    const searchTerm = `%${filters.query}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  // Enabled filter
  if (filters.enabled !== undefined) {
    whereClauses.push('enabled = ?');
    params.push(filters.enabled ? 1 : 0);
  }

  // Date range
  if (filters.dateFrom) {
    whereClauses.push('createdAt >= ?');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    whereClauses.push('createdAt <= ?');
    params.push(filters.dateTo);
  }

  // Tags
  if (filters.tags && filters.tags.length > 0) {
    const tagConditions = filters.tags.map(() => 'tags LIKE ?');
    whereClauses.push(`(${tagConditions.join(' OR ')})`);
    filters.tags.forEach(tag => params.push(`%${tag}%`));
  }

  const whereClause = whereClauses.length > 0
    ? `WHERE ${whereClauses.join(' AND ')}`
    : '';

  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM api_endpoints ${whereClause}`;
  const countResult = db.prepare(countQuery).get(...params) as { total: number };

  // Get paginated results
  const dataQuery = `
    SELECT * FROM api_endpoints
    ${whereClause}
    ORDER BY createdAt DESC
    LIMIT ? OFFSET ?
  `;
  const items = db.prepare(dataQuery).all(...params, pageSize, offset);

  return {
    items,
    total: countResult.total,
    page,
    pageSize,
    hasMore: offset + items.length < countResult.total
  };
}

/**
 * Search integrations with filters
 */
export async function searchIntegrations(
  filters: SearchFilters,
  page: number = 1,
  pageSize: number = 20
): Promise<SearchResult<any>> {
  const db = await getDB();
  const offset = (page - 1) * pageSize;

  let whereClauses: string[] = [];
  let params: any[] = [];

  if (filters.query) {
    whereClauses.push('name LIKE ?');
    params.push(`%${filters.query}%`);
  }

  if (filters.platform) {
    whereClauses.push('platform = ?');
    params.push(filters.platform);
  }

  if (filters.enabled !== undefined) {
    whereClauses.push('enabled = ?');
    params.push(filters.enabled ? 1 : 0);
  }

  if (filters.tags && filters.tags.length > 0) {
    const tagConditions = filters.tags.map(() => 'tags LIKE ?');
    whereClauses.push(`(${tagConditions.join(' OR ')})`);
    filters.tags.forEach(tag => params.push(`%${tag}%`));
  }

  const whereClause = whereClauses.length > 0
    ? `WHERE ${whereClauses.join(' AND ')}`
    : '';

  const countQuery = `SELECT COUNT(*) as total FROM integrations ${whereClause}`;
  const countResult = db.prepare(countQuery).get(...params) as { total: number };

  const dataQuery = `
    SELECT * FROM integrations
    ${whereClause}
    ORDER BY createdAt DESC
    LIMIT ? OFFSET ?
  `;
  const items = db.prepare(dataQuery).all(...params, pageSize, offset);

  return {
    items,
    total: countResult.total,
    page,
    pageSize,
    hasMore: offset + items.length < countResult.total
  };
}

/**
 * Search request logs
 */
export async function searchRequestLogs(
  filters: SearchFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<SearchResult<any>> {
  const db = await getDB();
  const offset = (page - 1) * pageSize;

  let whereClauses: string[] = [];
  let params: any[] = [];

  if (filters.query) {
    whereClauses.push('(apiEndpointId LIKE ? OR payload LIKE ?)');
    const searchTerm = `%${filters.query}%`;
    params.push(searchTerm, searchTerm);
  }

  if (filters.status) {
    whereClauses.push('status = ?');
    params.push(filters.status);
  }

  if (filters.dateFrom) {
    whereClauses.push('timestamp >= ?');
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    whereClauses.push('timestamp <= ?');
    params.push(filters.dateTo);
  }

  const whereClause = whereClauses.length > 0
    ? `WHERE ${whereClauses.join(' AND ')}`
    : '';

  const countQuery = `SELECT COUNT(*) as total FROM request_logs ${whereClause}`;
  const countResult = db.prepare(countQuery).get(...params) as { total: number };

  const dataQuery = `
    SELECT * FROM request_logs
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `;
  const items = db.prepare(dataQuery).all(...params, pageSize, offset);

  return {
    items,
    total: countResult.total,
    page,
    pageSize,
    hasMore: offset + items.length < countResult.total
  };
}
```

### Step 2: Create Search API Route

**File**: `src/app/api/search/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { searchEndpoints, searchIntegrations, searchRequestLogs } from '@/lib/search';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { type, filters, page = 1, pageSize = 20 } = body;

    let results;

    switch (type) {
      case 'endpoints':
        results = await searchEndpoints(filters, page, pageSize);
        break;
      case 'integrations':
        results = await searchIntegrations(filters, page, pageSize);
        break;
      case 'logs':
        results = await searchRequestLogs(filters, page, pageSize);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid search type' },
          { status: 400 }
        );
    }

    return NextResponse.json(results);
  } catch (error) {
    logger.error('Search failed', { error });
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
```

### Step 3: Create Search UI Component

**File**: `src/components/advanced-search.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Filter, X } from 'lucide-react';
import { SearchFilters } from '@/lib/search';

interface AdvancedSearchProps {
  onSearch: (filters: SearchFilters) => void;
  type: 'endpoints' | 'integrations' | 'logs';
}

export function AdvancedSearch({ onSearch, type }: AdvancedSearchProps) {
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  function handleSearch() {
    onSearch(filters);
  }

  function clearFilters() {
    setFilters({});
    onSearch({});
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search & Filter
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Filter className="h-4 w-4 mr-2" />
            {showAdvanced ? 'Hide' : 'Show'} Filters
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Search */}
        <div className="flex gap-2">
          <Input
            placeholder="Search..."
            value={filters.query || ''}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch}>Search</Button>
          {Object.keys(filters).length > 0 && (
            <Button variant="outline" onClick={clearFilters}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            {type === 'integrations' && (
              <div>
                <Label>Platform</Label>
                <Select
                  value={filters.platform || ''}
                  onValueChange={(value) => setFilters({ ...filters, platform: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All platforms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All platforms</SelectItem>
                    <SelectItem value="slack">Slack</SelectItem>
                    <SelectItem value="teams">Teams</SelectItem>
                    <SelectItem value="discord">Discord</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Status</Label>
              <Select
                value={filters.enabled?.toString() || ''}
                onValueChange={(value) => setFilters({
                  ...filters,
                  enabled: value === '' ? undefined : value === 'true'
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="true">Enabled</SelectItem>
                  <SelectItem value="false">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>From Date</Label>
              <Input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              />
            </div>

            <div>
              <Label>To Date</Label>
              <Input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## Testing the UI Enhancements

### Test Dark Mode

1. Toggle between light/dark/system modes
2. Verify theme persists after page reload
3. Test system theme auto-detection
4. Check smooth transitions between themes

### Test Bulk Operations

1. Select multiple endpoints/integrations
2. Test enable/disable bulk actions
3. Test bulk delete with confirmation
4. Verify selections clear after action

### Test Advanced Search

1. Search with text queries
2. Apply multiple filters simultaneously
3. Test pagination with filtered results
4. Verify clear filters functionality

