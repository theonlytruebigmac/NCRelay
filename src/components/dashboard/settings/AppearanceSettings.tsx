"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Sun, Moon, Laptop } from "lucide-react";

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const [currentTheme, setCurrentTheme] = useState(theme);

  // Update local state when theme changes externally
  useEffect(() => {
    setCurrentTheme(theme);
  }, [theme]);

  const handleThemeChange = (value: string) => {
    const newTheme = value as "light" | "dark" | "system";
    setCurrentTheme(newTheme);
    setTheme(newTheme);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <RadioGroup 
          value={currentTheme} 
          onValueChange={handleThemeChange}
          className="grid grid-cols-3 gap-4"
        >
          <div>
            <RadioGroupItem 
              value="light" 
              id="theme-light" 
              className="peer sr-only" 
            />
            <Label
              htmlFor="theme-light"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-gray-50 dark:hover:bg-gray-900 hover:border-gray-200 peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
            >
              <Sun className="mb-3 h-6 w-6" />
              <span className="text-sm font-medium">Light</span>
            </Label>
          </div>
          
          <div>
            <RadioGroupItem 
              value="dark" 
              id="theme-dark" 
              className="peer sr-only" 
            />
            <Label
              htmlFor="theme-dark"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-gray-50 hover:border-gray-200 peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer dark:hover:bg-gray-900"
            >
              <Moon className="mb-3 h-6 w-6" />
              <span className="text-sm font-medium">Dark</span>
            </Label>
          </div>
          
          <div>
            <RadioGroupItem 
              value="system" 
              id="theme-system" 
              className="peer sr-only" 
            />
            <Label
              htmlFor="theme-system"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted p-4 hover:bg-gray-50 hover:border-gray-200 peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer dark:hover:bg-gray-900"
            >
              <Laptop className="mb-3 h-6 w-6" />
              <span className="text-sm font-medium">System</span>
            </Label>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
