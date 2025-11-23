import { 
  LayoutDashboard, 
  Rss, 
  Waypoints, 
  History, 
  ShieldCheck, 
  Filter, 
  Building2, 
  ShieldAlert, 
  Users, 
  Shield, 
  Mail,
  Bell,
  FileText,
  Activity,
  ListOrdered,
  BookOpen
} from 'lucide-react';

export type NavItem = {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  external?: boolean;
  systemAdminOnly?: boolean; // Only visible to system administrators
  requiredPermission?: {
    resource: string;
    action: string;
  };
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const siteConfig = {
  name: "NCRelay",
  description: "Securely relay notifications to your favorite platforms.",
  mainNav: [
    {
      title: "Overview",
      items: [
        {
          title: "Dashboard",
          href: "/dashboard",
          icon: LayoutDashboard,
        },
        {
          title: "Queue",
          href: "/dashboard/queue",
          icon: ListOrdered,
          requiredPermission: { resource: 'logs', action: 'read' },
        },
        {
          title: "API Docs",
          href: "/dashboard/docs/api",
          icon: BookOpen,
        }
      ]
    },
    {
      title: "Flow",
      items: [
        {
          title: "Endpoints",
          href: "/dashboard/settings/api", 
          icon: Waypoints,
          requiredPermission: { resource: 'endpoints', action: 'read' },
        },
        {
          title: "Integrations",
          href: "/dashboard/integrations",
          icon: Rss,
          requiredPermission: { resource: 'integrations', action: 'read' },
        },
        {
          title: "Field Filters",
          href: "/dashboard/filters",
          icon: Filter,
          requiredPermission: { resource: 'field_filters', action: 'read' },
        }
      ]
    },
    {
      title: "Security Center",
      items: [
        {
          title: "Logs",
          href: "/dashboard/audit-logs",
          icon: History,
          requiredPermission: { resource: 'logs', action: 'read' },
        },
        {
          title: "Sessions",
          href: "/dashboard/settings/sessions",
          icon: Shield,
          requiredPermission: { resource: 'settings', action: 'read' },
        },
        {
          title: "Policies",
          href: "/dashboard/settings/security-policies",
          icon: ShieldAlert,
          requiredPermission: { resource: 'settings', action: 'manage' },
        },
        {
          title: "Users",
          href: "/dashboard/users",
          icon: Users,
          requiredPermission: { resource: 'users', action: 'read' },
        },
        {
          title: "Roles",
          href: "/dashboard/roles",
          icon: ShieldCheck,
          requiredPermission: { resource: 'users', action: 'manage' },
        }
      ]
    },
    {
      title: "Settings",
      items: [
        {
          title: "Notifications",
          href: "/dashboard/settings/notifications",
          icon: Bell,
          requiredPermission: { resource: 'settings', action: 'read' },
        },
        {
          title: "SMTP Config",
          href: "/dashboard/settings/smtp",
          icon: Mail,
          requiredPermission: { resource: 'settings', action: 'update' },
        }
      ]
    },
    {
      title: "Admin Settings",
      items: [
        {
          title: "Global SMTP",
          href: "/dashboard/admin/smtp",
          icon: Mail,
          systemAdminOnly: true,
          requiredPermission: { resource: 'settings', action: 'manage' },
        },
        {
          title: "System Notifications",
          href: "/dashboard/settings/notifications",
          icon: Bell,
          systemAdminOnly: true,
          requiredPermission: { resource: 'settings', action: 'read' },
        },
        {
          title: "Tenants",
          href: "/tenants",
          icon: Building2,
          systemAdminOnly: true,
          requiredPermission: { resource: 'tenant', action: 'read' },
        },
        {
          title: "Admin API Docs",
          href: "/dashboard/docs/admin",
          icon: BookOpen,
          systemAdminOnly: true,
        }
      ]
    }
  ] satisfies NavGroup[],
};
