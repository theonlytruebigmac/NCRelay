
"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet'; // Added SheetClose
import { Menu, LogOut, Settings, UserCircle } from 'lucide-react';
import { Logo } from '@/components/icons/Logo';
import { AppSidebarNav } from '@/components/layout/AppSidebarNav';
import { siteConfig } from '@/config/site';
import { Separator }from '@/components/ui/separator';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen flex-col">
        <Skeleton className="h-16 w-full border-b md:hidden" />
        <div className="flex flex-1">
          <Skeleton className="hidden h-full w-64 border-r md:block" />
          <main className="flex-1 p-8">
            <Skeleton className="h-10 w-1/4 mb-4" />
            <Skeleton className="h-32 w-full" />
          </main>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-screen flex-col">
        <div className="flex flex-1">
          <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar md:flex">
            <AppSidebar />
          </aside>
          <main className="flex-1 md:pl-64">
            <div className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background px-4 md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Toggle Menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0 flex flex-col bg-sidebar text-sidebar-foreground">
                  <div className="flex h-16 items-center border-b border-sidebar-border px-4">
                    <Link href="/dashboard" className="flex items-center space-x-2">
                      <Logo className="h-auto w-24 fill-primary" />
                    </Link>
                  </div>
                  <div className="flex-1 py-4 overflow-y-auto">
                    <AppSidebarNav items={siteConfig.mainNav} isMobile={true} />
                  </div>
                  <Separator className="bg-sidebar-border" />
                  <div className="p-4 space-y-2">
                    {user && (
                      <div className="mb-2 text-sm">
                        <p className="font-medium">{user.name || "User"}</p>
                        <p className="text-xs text-sidebar-foreground/70">{user.email}</p>
                      </div>
                    )}
                    <SheetClose asChild>
                      <Button variant="ghost" asChild className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                        <Link href="/dashboard/profile">
                          <UserCircle className="mr-2 h-4 w-4" />
                          Profile
                        </Link>
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button variant="ghost" asChild className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                        <Link href="/dashboard/settings">
                          <Settings className="mr-2 h-4 w-4" />
                          Settings
                        </Link>
                      </Button>
                    </SheetClose>
                    <Button variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={logout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
              
              {/* User Avatar Dropdown removed from mobile header */}
              <div>{/* Empty div to keep justify-between happy if needed, or remove justify-between from parent */}</div>
            </div>
            
            <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
