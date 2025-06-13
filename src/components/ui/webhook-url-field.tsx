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

  // Determine if this is a new webhook entry (form field with no existing value)
  const isNewWebhook = isFormField && !value;
  
  // For new webhooks being created, show empty field rather than bullets
  // For existing webhooks, show bullets when hidden
  const displayValue = isVisible ? value : (isNewWebhook ? "" : (value ? "••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••" : ""));

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <div className="relative flex-grow">
        <Input
          type="text"
          // For new webhooks (no value), show empty field
          // For existing webhooks, show actual value if visible, otherwise bullets
          value={displayValue}
          onChange={onChange ? (e) => {
            // Allow changes when:
            // 1. It's a new webhook (form field with no existing value), OR
            // 2. The webhook is visible
            if (isNewWebhook || isVisible) {
              onChange(e.target.value);
            }
          } : undefined}
          placeholder={isFormField ? placeholder : (isVisible ? placeholder : "Click the eye icon to reveal webhook URL")}
          disabled={disabled}
          className="pr-10"
          // Make it editable when:
          // 1. It's a form field AND it's a new webhook (no value), OR
          // 2. It's a form field AND the webhook is visible
          readOnly={!(isFormField && (isNewWebhook || isVisible))}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2 hover:bg-secondary"
          onClick={() => setIsVisible(!isVisible)}
          // Only show eye icon if there's a value to hide/show
          // For new webhooks with no value, hide the button
          disabled={isNewWebhook}
          style={{ opacity: isNewWebhook ? 0 : 1 }}
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
