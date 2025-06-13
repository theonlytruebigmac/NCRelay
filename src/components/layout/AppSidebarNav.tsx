
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem, NavGroup } from "@/config/site";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { SheetClose } from "@/components/ui/sheet"; // For mobile sidebar
import { Separator } from "@/components/ui/separator";

interface AppSidebarNavProps {
  items: NavGroup[];
  className?: string;
  isMobile?: boolean; // To close sheet on mobile nav click
}

export function AppSidebarNav({ items, className, isMobile = false }: AppSidebarNavProps) {
  const pathname = usePathname();

  if (!items?.length) {
    return null;
  }
  
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
    <nav className={cn("flex flex-col space-y-1 p-2", className)}>
      {items.map((group, groupIndex) => (
        <div key={groupIndex} className="py-2">
          {groupIndex > 0 && <Separator className="my-2 bg-sidebar-border" />}
          <div className="px-3 py-2">
            <h3 className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
              {group.title}
            </h3>
          </div>
          <div className="space-y-1">
            {group.items.map((item, itemIndex) => (
              <NavLink key={itemIndex} item={item} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
