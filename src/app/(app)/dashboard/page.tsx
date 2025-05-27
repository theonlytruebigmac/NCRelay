
"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/layout/PageShell";
import { useAuth } from "@/context/AuthContext";
import { Lightbulb, Settings, Zap, History } from "lucide-react";
import { useEffect, useState } from "react";
import { getDashboardStatsAction } from './actions'; // Import the new Server Action
import type { DashboardStats } from "./actions";
import { Skeleton } from "@/components/ui/skeleton";


export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setIsLoadingStats(true);
      try {
        const fetchedStats = await getDashboardStatsAction();
        setStats(fetchedStats);
      } catch (error) {
        console.error("Failed to load dashboard stats:", error);
        // Set to 0 or handle error appropriately
        setStats({ activeIntegrationsCount: 0, relayedNotificationsCount: 0 });
      } finally {
        setIsLoadingStats(false);
      }
    }
    fetchStats();
  }, []);


  return (
    <PageShell
      title={`Welcome, ${user?.name || 'User'}!`}
      description="Manage your notification relays and integrations."
    >
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Integrations
            </CardTitle>
            <Zap className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoadingStats || !stats ? (
              <Skeleton className="h-8 w-1/4 mb-1" />
            ) : (
              <div className="text-2xl font-bold">{stats.activeIntegrationsCount}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Currently relaying notifications
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/dashboard/integrations">Manage Integrations</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Requests Logged
            </CardTitle>
            <History className="h-5 w-5 text-accent" /> 
          </CardHeader>
          <CardContent>
            {isLoadingStats || !stats ? (
               <Skeleton className="h-8 w-1/4 mb-1" />
            ) : (
             <div className="text-2xl font-bold">{stats.relayedNotificationsCount}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Total API requests logged (Last 50)
            </p>
             <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/dashboard/logs">View Logs</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              API Endpoints
            </CardTitle>
            <Settings className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Define custom API endpoints for receiving data.
            </p>
            <Button asChild variant="secondary" size="sm" className="mt-4">
              <Link href="/dashboard/settings/api">Configure Endpoints</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Lightbulb className="mr-2 h-6 w-6 text-yellow-400" />
            Quick Start Guide
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>1. Go to <Link href="/dashboard/integrations" className="text-primary hover:underline">Integrations</Link> to add or edit messaging platforms.</p>
          <p>2. Go to <Link href="/dashboard/settings/api" className="text-primary hover:underline">API Endpoints</Link> to create custom API paths and link them to your integrations.</p>
          <p>3. Use your configured custom API endpoint URL to send XML data to RelayZen.</p>
          <p>4. Check the <Link href="/dashboard/logs" className="text-primary hover:underline">Logs</Link> page to see processed requests.</p>
          <p>5. RelayZen will process and relay your notifications to the linked platforms!</p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
