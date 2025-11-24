
"use client";

import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import { Logo } from "@/components/icons/Logo";
import { AppSidebarNav } from "./AppSidebarNav";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { LogOut, UserCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { TenantSwitcher } from "@/components/tenant/TenantSwitcher";


export function AppSidebar({ className }: React.HTMLAttributes<HTMLDivElement>) {
  const { user, logout } = useAuth();
  
  return (
    <div className={cn("h-full border-r bg-sidebar text-sidebar-foreground", className)}>
      <div className="flex h-full max-h-screen flex-col">
        <div className="border-b border-sidebar-border px-4 py-3">
          <TenantSwitcher />
        </div>
        <ScrollArea className="flex-1 py-4">
          <AppSidebarNav items={siteConfig.mainNav} />
        </ScrollArea>
        <Separator className="bg-sidebar-border" />
        <div className="p-4">
          {user && (
            <div className="mb-3">
              <p className="font-medium text-sm">{user.name || "User"}</p>
              <p className="text-xs text-sidebar-foreground/70 truncate">{user.email}</p>
            </div>
          )}
          <div className="space-y-1">
            <Link href="/dashboard/profile">
              <Button 
                variant="ghost" 
                className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <UserCircle className="mr-2 h-4 w-4" />
                Profile
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" 
              onClick={logout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
