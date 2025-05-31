"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface WebhookUrlFieldProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showCopyButton?: boolean;
  isFormField?: boolean;
}

export function WebhookUrlField({
  value,
  onChange,
  placeholder = "https://hooks.slack.com/services/...",
  disabled = false,
  className,
  showCopyButton = true,
  isFormField = false,
}: WebhookUrlFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Webhook URL Copied!" });
    } catch (error) {
      toast({ 
        title: "Failed to copy", 
        description: "Could not copy to clipboard",
        variant: "destructive" 
      });
    }
  };

  const displayValue = isVisible ? value : value ? "••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••" : "";

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <div className="relative flex-grow">
        <Input
          type={isVisible ? "url" : "text"}
          value={displayValue}
          onChange={onChange ? (e) => {
            if (isVisible) {
              onChange(e.target.value);
            }
          } : undefined}
          placeholder={isVisible ? placeholder : "Click the eye icon to reveal webhook URL"}
          disabled={disabled}
          className="pr-10"
          readOnly={!isFormField || !isVisible}
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
            {isVisible ? "Hide" : "Show"} webhook URL
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
          <span className="sr-only">Copy webhook URL</span>
        </Button>
      )}
    </div>
  );
}
