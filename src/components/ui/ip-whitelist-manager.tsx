import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface IpWhitelistManagerProps {
  ipList: string[];
  onIpListChange: (newList: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function IpWhitelistManager({ 
  ipList, 
  onIpListChange, 
  disabled = false, 
  placeholder = "e.g., 192.168.1.100" 
}: IpWhitelistManagerProps) {
  const [newIpAddress, setNewIpAddress] = useState('');
  const { toast } = useToast();

  const addIpToList = () => {
    if (!newIpAddress.trim()) return;
    
    // Simple IP validation regex (both IPv4 and IPv6)
    const ipRegex = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$|^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    
    if (!ipRegex.test(newIpAddress.trim())) {
      toast({
        variant: "destructive",
        title: "Invalid IP Address",
        description: "Please enter a valid IPv4 or IPv6 address.",
      });
      return;
    }
    
    if (ipList.includes(newIpAddress.trim())) {
      toast({
        variant: "destructive",
        title: "Duplicate IP",
        description: "This IP address is already in the list.",
      });
      return;
    }
    
    onIpListChange([...ipList, newIpAddress.trim()]);
    setNewIpAddress("");
  };

  const removeIpFromList = (ip: string) => {
    onIpListChange(ipList.filter(i => i !== ip));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addIpToList();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder={placeholder}
          value={newIpAddress}
          onChange={(e) => setNewIpAddress(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={disabled}
          className="flex-1"
        />
        <Button 
          type="button" 
          onClick={addIpToList} 
          size="sm"
          disabled={disabled || !newIpAddress.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      {ipList.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Allowed IP addresses ({ipList.length}):
          </div>
          <div className="flex flex-wrap gap-2">
            {ipList.map((ip) => (
              <Badge key={ip} variant="secondary" className="text-xs">
                {ip}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeIpFromList(ip)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      {ipList.length === 0 && (
        <div className="text-sm text-muted-foreground">
          No IP restrictions configured. All IP addresses will be allowed to access this endpoint.
        </div>
      )}
    </div>
  );
}
