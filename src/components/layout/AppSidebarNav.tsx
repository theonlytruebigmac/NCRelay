
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem, NavGroup } from "@/config/site";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { SheetClose } from "@/components/ui/sheet"; // For mobile sidebar
import { Separator } from "@/components/ui/separator";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/context/AuthContext";

interface AppSidebarNavProps {
  items: NavGroup[];
  className?: string;
  isMobile?: boolean; // To close sheet on mobile nav click
}

export function AppSidebarNav({ items, className, isMobile = false }: AppSidebarNavProps) {
  const pathname = usePathname();
  const { can } = usePermissions();
  const { user } = useAuth();

  if (!items?.length) {
    return null;
  }
  
  // Filter navigation items based on permissions and system admin status
  const filteredItems = items
    .map(group => {
      // Filter "Admin Settings" - only show to system admins
      if (group.title === "Admin Settings" && !user?.isAdmin) {
        return null;
      }
      
      // Filter "Tenant Settings" - hide from system admins
      if (group.title === "Tenant Settings" && user?.isAdmin) {
        return null;
      }
      
      return {
        ...group,
        items: group.items.filter(item => {
          // Check if item is system admin only
          if (item.systemAdminOnly && !user?.isAdmin) {
            return false;
          }
          
          // Check permissions
          if (!item.requiredPermission) return true;
          return can(item.requiredPermission.resource as any, item.requiredPermission.action as any);
        })
      };
    })
    .filter((group): group is NavGroup => group !== null && group.items.length > 0);
  
  const NavLinkContent = ({ item }: { item: NavItem }) => (
    <>
      {item.icon && <item.icon className="mr-2 h-4 w-4" />}
      {item.title}
    </>
  );

  const NavLink = ({ item }: { item: NavItem }) => {
    const linkContent = <NavLinkContent item={item} />;
    const linkClasses = cn(
      buttonVariants({ variant: "ghost" }),
      "w-full justify-start",
      pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
        ? "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/90"
        : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    );

    if (isMobile) {
      return (
        <SheetClose asChild>
          <Link href={item.href} className={linkClasses}>
            {linkContent}
          </Link>
        </SheetClose>
      );
    }
    return (
      <Link href={item.href} className={linkClasses}>
        {linkContent}
      </Link>
    );
  };


  return (
    <nav className={cn("flex flex-col space-y-0.5 p-2", className)}>
      {filteredItems.map((group, groupIndex) => (
        <div key={groupIndex} className="py-1">
          <div className="px-3 py-1.5">
            <h3 className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
              {group.title}
            </h3>
          </div>
          <div className="space-y-0.5">
            {group.items.map((item, itemIndex) => (
              <NavLink key={itemIndex} item={item} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
