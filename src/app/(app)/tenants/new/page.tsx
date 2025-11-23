'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageShell } from '@/components/layout/PageShell';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function NewTenantPage() {
  const { user } = useAuth();
  const { refreshTenants } = useTenant();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    domain: '',
    plan: 'free' as 'free' | 'pro' | 'enterprise',
    maxEndpoints: 10,
    maxIntegrations: 5,
    maxRequestsPerMonth: 10000,
  });

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.isAdmin) {
      toast({
        title: 'Access Denied',
        description: 'Only administrators can create tenants',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create tenant');
      }

      toast({
        title: 'Tenant Created',
        description: `Successfully created tenant ${formData.name}`,
      });

      // Refresh tenant list in context
      await refreshTenants();
      
      router.push('/tenants');
    } catch (error) {
      console.error('Error creating tenant:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create tenant',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user?.isAdmin) {
    return (
      <div className="container mx-auto py-8">
        <Card className="shadow-lg">
          <CardContent className="py-12">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
              <p className="text-muted-foreground mb-4">
                Only administrators can create tenants
              </p>
              <Button onClick={() => router.push('/tenants')}>
                Back to Tenants
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PageShell
      title="Create New Tenant"
      description="Set up a new organization workspace with custom settings"
      actions={
        <Button
          variant="ghost"
          onClick={() => router.push('/tenants')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      }
    >
      <div className="max-w-2xl">
        <Card className="shadow-lg animate-fade-in">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Tenant Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="My Organization"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value })
                }
                placeholder="my-organization"
                pattern="[a-z0-9-]+"
                required
              />
              <p className="text-sm text-muted-foreground">
                Used in URLs and tenant identification
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain">Custom Domain (Optional)</Label>
              <Input
                id="domain"
                value={formData.domain}
                onChange={(e) =>
                  setFormData({ ...formData, domain: e.target.value })
                }
                placeholder="notifications.example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan">Plan</Label>
              <Select
                value={formData.plan}
                onValueChange={(value: 'free' | 'pro' | 'enterprise') =>
                  setFormData({ ...formData, plan: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxEndpoints">Max Endpoints</Label>
                <Input
                  id="maxEndpoints"
                  type="number"
                  min="1"
                  value={formData.maxEndpoints}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxEndpoints: parseInt(e.target.value),
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxIntegrations">Max Integrations</Label>
                <Input
                  id="maxIntegrations"
                  type="number"
                  min="1"
                  value={formData.maxIntegrations}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxIntegrations: parseInt(e.target.value),
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxRequests">Max Requests/Mo</Label>
                <Input
                  id="maxRequests"
                  type="number"
                  min="1"
                  value={formData.maxRequestsPerMonth}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxRequestsPerMonth: parseInt(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={loading} className="flex-1 transition-all duration-200">
                {loading ? 'Creating...' : 'Create Tenant'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/tenants')}
                className="transition-all duration-200 hover:bg-muted"
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      </div>
    </PageShell>
  );
}
