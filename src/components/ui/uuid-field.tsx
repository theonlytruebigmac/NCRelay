"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface UuidFieldProps {
  value: string;
  className?: string;
  showCopyButton?: boolean;
}

export function UuidField({
  value,
  className,
  showCopyButton = true,
}: UuidFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "UUID Copied!" });
    } catch (error) {
      toast({ 
        title: "Failed to copy", 
        description: "Could not copy to clipboard",
        variant: "destructive" 
      });
    }
  };

  // Show last 12 characters when hidden, full value when visible
  const displayValue = isVisible ? value : value ? `...${value.slice(-12)}` : "";

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <div className="relative flex-grow">
        <Input
          type="text"
          value={displayValue}
          placeholder={isVisible ? "UUID will appear here" : "Click eye to show full UUID"}
          disabled={true}
          className="pr-10 font-mono text-sm"
          readOnly={true}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2 hover:bg-secondary"
          onClick={() => setIsVisible(!isVisible)}
          tabIndex={-1}
        >
          {isVisible ? (
            <EyeOff className="h-3 w-3" />
          ) : (
            <Eye className="h-3 w-3" />
          )}
          <span className="sr-only">
            {isVisible ? "Hide full UUID" : "Show full UUID"}
          </span>
        </Button>
      </div>
      {showCopyButton && value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="shrink-0"
          tabIndex={-1}
        >
          <Copy className="h-4 w-4" />
          <span className="sr-only">Copy UUID</span>
        </Button>
      )}
    </div>
  );
}
