import { LayoutDashboard, Rss, Waypoints, History, ShieldCheck, Filter, RefreshCw } from 'lucide-react';

export type NavItem = {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  external?: boolean;
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
        }
      ]
    },
    {
      title: "Inbound",
      items: [
        {
          title: "Endpoints",
          href: "/dashboard/settings/api", 
          icon: Waypoints, 
        },
        {
          title: "Security",
          href: "/dashboard/settings/security",
          icon: ShieldCheck,
        }
      ]
    },
    {
      title: "Outbound",
      items: [
        {
          title: "Integrations",
          href: "/dashboard/integrations",
          icon: Rss,
        },
        {
          title: "Field Filters",
          href: "/dashboard/filters",
          icon: Filter,
        }
      ]
    },
    {
      title: "System",
      items: [
        {
          title: "Queue",
          href: "/dashboard/queue",
          icon: RefreshCw,
        },
        {
          title: "Logging",
          href: "/dashboard/logs",
          icon: History,
        }
      ]
    }
  ] satisfies NavGroup[],
};
