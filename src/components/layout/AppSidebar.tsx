
"use client";

import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import { Logo } from "@/components/icons/Logo";
import { AppSidebarNav } from "./AppSidebarNav";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, UserCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";


export function AppSidebar({ className }: React.HTMLAttributes<HTMLDivElement>) {
  const { user, logout } = useAuth();
  
  return (
    <div className={cn("h-full border-r bg-sidebar text-sidebar-foreground", className)}>
      <div className="flex h-full max-h-screen flex-col">
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <Link href="/dashboard" className="flex items-center space-x-2 w-full">
            <Logo className="h-auto w-full max-w-[160px] fill-primary" />
          </Link>
          {/* User Avatar Dropdown removed from here */}
        </div>
        <ScrollArea className="flex-1 py-4">
          <AppSidebarNav items={siteConfig.mainNav} />
        </ScrollArea>
        <Separator className="bg-sidebar-border" />
        <div className="p-4 space-y-2">
           {user && (
            <div className="mb-2 text-sm">
              <p className="font-medium">{user.name || "User"}</p>
              <p className="text-xs text-sidebar-foreground/70">{user.email}</p>
            </div>
           )}
          <Button variant="ghost" asChild className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <Link href="/dashboard/profile">
              <UserCircle className="mr-2 h-4 w-4" />
              Profile
            </Link>
          </Button>
          <Button variant="ghost" asChild className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <Link href="/dashboard/settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
          <Button variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}
