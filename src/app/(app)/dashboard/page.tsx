"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/layout/PageShell";
import { useAuth } from "@/context/AuthContext";
import { Lightbulb, Settings, Zap, History, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import { getDashboardStatsAction } from './actions'; // Import the new Server Action
import type { DashboardStats } from "./actions";
import { Skeleton } from "@/components/ui/skeleton";


export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isQuickStartExpanded, setIsQuickStartExpanded] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      setIsLoadingStats(true);
      try {
        const fetchedStats = await getDashboardStatsAction();
        setStats(fetchedStats);
      } catch (error) {
        console.error("Failed to load dashboard stats:", error);
        // Set to 0 or handle error appropriately
        setStats({ 
          activeIntegrationsCount: 0, 
          relayedNotificationsCount: 0,
          apiEndpointsCount: 0,
          apiEndpointsRequestsCount: 0,
          outboundSuccessCount: 0,
          outboundFailureCount: 0,
          outboundSuccessRate: 0,
          totalOutboundAttempts: 0,
        });
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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
              Active Endpoints
            </CardTitle>
            <Settings className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoadingStats || !stats ? (
              <Skeleton className="h-8 w-1/4 mb-1" />
            ) : (
              <div className="text-2xl font-bold">{stats.apiEndpointsCount}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Custom endpoints configured
            </p>
            {!isLoadingStats && stats && stats.apiEndpointsRequestsCount > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {stats.apiEndpointsRequestsCount} requests processed via endpoints
              </p>
            )}
            <Button asChild variant="secondary" size="sm" className="mt-4">
              <Link href="/dashboard/settings/api">Configure Endpoints</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Outbound Success Rate Card */}
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Success Rate
            </CardTitle>
            <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-white"></div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingStats || !stats ? (
              <Skeleton className="h-8 w-1/4 mb-1" />
            ) : (
              <div className="text-2xl font-bold text-green-600">{stats.outboundSuccessRate}%</div>
            )}
            <p className="text-xs text-muted-foreground">
              {!isLoadingStats && stats && stats.totalOutboundAttempts > 0 
                ? `${stats.outboundSuccessCount}/${stats.totalOutboundAttempts} successful relays`
                : "No outbound attempts yet"
              }
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/dashboard/logs">View Details</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Outbound Failures Card */}
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Failed Relays
            </CardTitle>
            <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-white"></div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingStats || !stats ? (
              <Skeleton className="h-8 w-1/4 mb-1" />
            ) : (
              <div className="text-2xl font-bold text-red-600">{stats.outboundFailureCount}</div>
            )}
            <p className="text-xs text-muted-foreground">
              {!isLoadingStats && stats && stats.totalOutboundAttempts > 0 
                ? `${Math.round((stats.outboundFailureCount / stats.totalOutboundAttempts) * 100)}% of total attempts`
                : "From recent logs (last 50)"
              }
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/dashboard/logs">Troubleshoot</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Lightbulb className="mr-2 h-6 w-6 text-yellow-400" />
              <CardTitle>Quick Start Guide</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsQuickStartExpanded(!isQuickStartExpanded)}
              className="h-8 w-8 p-0"
            >
              {isQuickStartExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
          <CardDescription>
            NCRelay is a powerful notification relay service that bridges your applications with popular messaging platforms.
          </CardDescription>
        </CardHeader>
        {isQuickStartExpanded && (
          <CardContent className="space-y-4">
            <div className="mb-4">
              <h4 className="font-medium mb-2 text-foreground">Key Features:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• <strong>Multi-Platform Support:</strong> Send notifications to Discord, Slack, Teams, and more</li>
                <li>• <strong>Custom API Endpoints:</strong> Create personalized endpoints for your applications</li>
                <li>• <strong>XML Processing:</strong> Automatically parse and format XML notification data</li>
                <li>• <strong>Real-time Logging:</strong> Monitor all requests and responses in real-time</li>
                <li>• <strong>Easy Integration:</strong> Simple REST API interface for seamless connectivity</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2 text-foreground">Getting Started:</h4>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>1. Go to <Link href="/dashboard/integrations" className="text-primary hover:underline">Integrations</Link> to add or edit messaging platforms.</p>
                <p>2. Go to <Link href="/dashboard/settings/api" className="text-primary hover:underline">API Endpoints</Link> to create custom API paths and link them to your integrations.</p>
                <p>3. Use your configured custom API endpoint URL to send XML data to NCRelay.</p>
                <p>4. Check the <Link href="/dashboard/logs" className="text-primary hover:underline">Logs</Link> page to see processed requests.</p>
                <p>5. NCRelay will process and relay your notifications to the linked platforms!</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </PageShell>
  );
}
