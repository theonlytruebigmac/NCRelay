'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PageShell } from '@/components/layout/PageShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  Trash2, 
  AlertCircle, 
  Loader2,
  MapPin,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Session {
  id: string;
  userName: string;
  userEmail: string;
  tenantName: string | null;
  ipAddress: string | null;
  location: string | null;
  deviceInfo: {
    browser: string;
    os: string;
    device: string;
    deviceType: string;
  } | null;
  lastActivityAt: string;
  createdAt: string;
  isCurrent?: boolean;
}

export default function SessionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      } else {
        const errorData = await response.json();
        console.error('Failed to load sessions:', errorData);
        toast({
          title: 'Error',
          description: errorData.error || 'Failed to load sessions',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load sessions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Revoke this session? You will be logged out on that device.')) {
      return;
    }

    setRevoking(sessionId);
    try {
      const response = await fetch(`/api/auth/sessions?sessionId=${sessionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Session Revoked',
          description: 'The session has been terminated',
        });
        await fetchSessions();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to revoke session',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to revoke session',
        variant: 'destructive',
      });
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAllOthers = async () => {
    if (!confirm('Revoke all other sessions? You will only remain logged in on this device.')) {
      return;
    }

    setRevoking('all');
    try {
      const response = await fetch('/api/auth/sessions?revokeOthers=true', {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Sessions Revoked',
          description: `${data.count} session(s) have been terminated`,
        });
        await fetchSessions();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to revoke sessions',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to revoke sessions',
        variant: 'destructive',
      });
    } finally {
      setRevoking(null);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'Mobile':
        return <Smartphone className="h-4 w-4" />;
      case 'Tablet':
        return <Tablet className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  };

  if (loading) {
    return (
      <PageShell
        title="Sessions"
        description="Manage devices and locations where you're currently logged in"
      >
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Sessions"
      description="Manage devices and locations where you're currently logged in"
    >
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div />
        {sessions.length > 1 && (
          <Button 
            onClick={handleRevokeAllOthers} 
            variant="outline"
            disabled={revoking === 'all'}
          >
            {revoking === 'all' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Revoke All Other Sessions
          </Button>
        )}
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          If you see a session you don't recognize, revoke it immediately and change your password.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Your Sessions ({sessions.length})</CardTitle>
          <CardDescription>
            Sessions expire after 8 hours of inactivity
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sessions found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Device Type</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {session.userName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {session.userEmail}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {session.tenantName ? (
                          <span>{session.tenantName}</span>
                        ) : (
                          <Badge variant="outline">System Admin</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium">
                              {session.deviceInfo?.browser || 'Unknown'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {session.deviceInfo?.os || 'Unknown OS'}
                            </div>
                          </div>
                          {session.isCurrent && (
                            <Badge variant="secondary" className="text-xs ml-2">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Current
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getDeviceIcon(session.deviceInfo?.deviceType || 'Desktop')}
                          <span className="capitalize text-sm">
                            {session.deviceInfo?.deviceType || 'Desktop'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono">
                          {session.ipAddress || 'Unknown'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {session.location || session.ipAddress || 'Unknown'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {formatRelativeTime(session.lastActivityAt)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(session.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {!session.isCurrent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevokeSession(session.id)}
                            disabled={revoking === session.id}
                          >
                            {revoking === session.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </PageShell>
  );
}
