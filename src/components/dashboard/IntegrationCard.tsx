
"use client";

import type { Integration } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { platformIcons, platformNames, getPlatformFormatDescription } from "@/lib/platform-helpers";
import { Edit, Trash2, Copy, Loader2 } from "lucide-react";
import { WebhookUrlField } from "@/components/ui/webhook-url-field";

interface IntegrationCardProps {
  integration: Integration;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  isToggling?: boolean; // To show loading state on switch
}

export function IntegrationCard({ integration, onToggleEnabled, onEdit, onDelete, isToggling = false }: IntegrationCardProps) {
  const PlatformIcon = platformIcons[integration.platform];
  
  return (
    <Card className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-xl">
            {PlatformIcon && <PlatformIcon className="mr-2 h-6 w-6 text-primary" />}
            {integration.name}
          </CardTitle>
          <Badge variant={integration.enabled ? "default" : "outline"} className={integration.enabled ? "bg-green-500 hover:bg-green-600 text-white" : ""}>
            {integration.enabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
        <CardDescription>{platformNames[integration.platform]}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-3">
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-1">Webhook URL</h4>
          <WebhookUrlField
            value={integration.webhookUrl}
            showCopyButton={true}
            disabled={true}
            className="text-sm"
          />
        </div>
        <div>
          <h4 className="text-sm font-medium text-muted-foreground">Format</h4>
          <p className="text-sm text-foreground">{getPlatformFormatDescription(integration.platform)}</p>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between border-t pt-4">
        <div className="flex items-center space-x-2">
          <Switch
            checked={integration.enabled}
            onCheckedChange={(checked) => onToggleEnabled(integration.id, checked)}
            aria-label={integration.enabled ? "Disable integration" : "Enable integration"}
            disabled={isToggling}
          />
           {isToggling && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {!isToggling && (
             <span className="text-sm text-muted-foreground">
               {integration.enabled ? "Enabled" : "Disabled"}
             </span>
          )}
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="icon" onClick={() => onEdit(integration.id)} aria-label="Edit integration">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="destructive" size="icon" onClick={() => onDelete(integration.id)} aria-label="Delete integration">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
