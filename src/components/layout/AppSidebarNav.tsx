
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/config/site";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SheetClose } from "@/components/ui/sheet"; // For mobile sidebar

interface AppSidebarNavProps {
  items: NavItem[];
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
      {items.map((item, index) => (
         <NavLink key={index} item={item} />
      ))}
    </nav>
  );
}
