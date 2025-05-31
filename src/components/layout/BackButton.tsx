"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  href: string;
  label?: string;
}

export function BackButton({ href, label = "Back" }: BackButtonProps) {
  return (
    <Button variant="outline" asChild className="mb-4">
      <Link href={href}>
        <ArrowLeft className="mr-2 h-4 w-4" /> {label}
      </Link>
    </Button>
  );
}
