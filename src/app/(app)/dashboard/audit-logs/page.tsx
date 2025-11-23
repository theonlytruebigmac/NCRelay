"use client";

import { useState, useEffect } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Shield, Filter, RefreshCw, Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface AuditLog {
  id: string;
  userId: string | null;
  tenantId: string | null;
  action: string;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
  tenantName: string | null;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  });
  const [actions, setActions] = useState<string[]>([]);
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchUserId, setSearchUserId] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    loadActions();
    loadLogs();
  }, []);

  async function loadActions() {
    try {
      const response = await fetch('/api/admin/audit-logs?getActions=true');
      if (!response.ok) throw new Error('Failed to load actions');
      const data = await response.json();
      setActions(data.actions);
    } catch (error) {
      console.error('Error loading actions:', error);
    }
  }

  async function loadLogs(page: number = 1) {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pagination.pageSize.toString(),
      });

      if (selectedAction && selectedAction !== 'all') params.append('action', selectedAction);
      if (searchUserId) params.append('userId', searchUserId);
      if (startDate) params.append('startDate', new Date(startDate).toISOString());
      if (endDate) params.append('endDate', new Date(endDate).toISOString());

      const response = await fetch(`/api/admin/audit-logs?${params}`);
      if (!response.ok) throw new Error('Failed to load audit logs');

      const data = await response.json();
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      toast({
        title: "Error",
        description: "Failed to load audit logs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleFilter() {
    loadLogs(1);
  }

  function handleClearFilters() {
    setSelectedAction("all");
    setStartDate("");
    setEndDate("");
    setSearchUserId("");
    setPagination((prev) => ({ ...prev, page: 1 }));
    setTimeout(() => loadLogs(1), 0);
  }

  function getActionBadge(action: string) {
    const actionConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      login_success: { variant: "default", label: "Login Success" },
      login_failed: { variant: "destructive", label: "Login Failed" },
      login_locked: { variant: "destructive", label: "Login Locked" },
      logout: { variant: "secondary", label: "Logout" },
      password_changed: { variant: "default", label: "Password Changed" },
      password_reset_requested: { variant: "secondary", label: "Password Reset Requested" },
      password_reset_completed: { variant: "default", label: "Password Reset Completed" },
      "2fa_enrolled": { variant: "default", label: "2FA Enrolled" },
      "2fa_disabled": { variant: "destructive", label: "2FA Disabled" },
      "2fa_reset": { variant: "destructive", label: "2FA Reset" },
      "2fa_enforced": { variant: "default", label: "2FA Enforced" },
      "2fa_unenforced": { variant: "secondary", label: "2FA Unenforced" },
      role_changed: { variant: "default", label: "Role Changed" },
      user_created: { variant: "default", label: "User Created" },
      user_deleted: { variant: "destructive", label: "User Deleted" },
      session_created: { variant: "default", label: "Session Created" },
      session_revoked: { variant: "secondary", label: "Session Revoked" },
      account_locked: { variant: "destructive", label: "Account Locked" },
      account_unlocked: { variant: "default", label: "Account Unlocked" },
      security_settings_updated: { variant: "default", label: "Security Settings Updated" },
    };

    const config = actionConfig[action] || { variant: "outline" as const, label: action };
    return (
      <Badge variant={config.variant}>
        {config.label}
      </Badge>
    );
  }

  function formatActionLabel(action: string): string {
    return action
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  function parseDetails(details: string | null): string {
    if (!details) return "-";
    try {
      const parsed = JSON.parse(details);
      return Object.entries(parsed)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");
    } catch {
      return details;
    }
  }

  return (
    <PageShell
      title="Security Audit Log"
      description="View security events and user activity"
      actions={
        <Button onClick={() => loadLogs(pagination.page)} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      }
    >
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>
            Filter audit logs by action, date range, or user
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {actions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {formatActionLabel(action)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>User ID</Label>
              <Input
                placeholder="Filter by user ID"
                value={searchUserId}
                onChange={(e) => setSearchUserId(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleFilter} size="sm">
              <Search className="mr-2 h-4 w-4" />
              Apply Filters
            </Button>
            <Button onClick={handleClearFilters} variant="outline" size="sm">
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Audit Logs ({pagination.total})
          </CardTitle>
          <CardDescription>
            Security events and user activity records
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No audit logs found
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">
                          {format(parseISO(log.createdAt), "MMM d, yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          {getActionBadge(log.action)}
                        </TableCell>
                        <TableCell>
                          {log.userName ? (
                            <div>
                              <div className="font-medium">{log.userName}</div>
                              <div className="text-xs text-muted-foreground">
                                {log.userEmail}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.tenantName || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.ipAddress || "-"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs">
                          {parseDetails(log.details)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => loadLogs(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      variant="outline"
                      size="sm"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      onClick={() => loadLogs(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                      variant="outline"
                      size="sm"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
