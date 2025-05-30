
import { Cog, LayoutDashboard, Rss, Waypoints, History, ShieldCheck, Filter } from 'lucide-react';

export type NavItem = {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  external?: boolean;
};

export const siteConfig = {
  name: "NCRelay",
  description: "Securely relay notifications to your favorite platforms.",
  mainNav: [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Integrations",
      href: "/dashboard/integrations",
      icon: Rss,
    },
    {
      title: "Field Filters",
      href: "/dashboard/filters",
      icon: Filter,
    },
    {
      title: "API Endpoints",
      href: "/dashboard/settings/api", 
      icon: Waypoints, 
    },
    {
      title: "Security",
      href: "/dashboard/settings/security",
      icon: ShieldCheck,
    },
    {
      title: "Request Logs",
      href: "/dashboard/logs",
      icon: History,
    }
  ] satisfies NavItem[],
};
