import type { Platform } from './types';
import { Slack, MessageSquare, Users, Webhook } from 'lucide-react';
import type React from 'react';

export const platformIcons: Record<Platform, React.ElementType> = {
  slack: Slack,
  discord: MessageSquare, // Using MessageSquare as a generic chat icon for Discord
  teams: Users, // Using Users icon for Teams
  generic_webhook: Webhook,
};

export const platformNames: Record<Platform, string> = {
  slack: 'Slack',
  discord: 'Discord',
  teams: 'Microsoft Teams',
  generic_webhook: 'Generic Webhook',
};

export const platformOptions: { value: Platform; label: string; icon: React.ElementType }[] = [
  { value: 'slack', label: platformNames.slack, icon: platformIcons.slack },
  { value: 'discord', label: platformNames.discord, icon: platformIcons.discord },
  { value: 'teams', label: platformNames.teams, icon: platformIcons.teams },
  { value: 'generic_webhook', label: platformNames.generic_webhook, icon: platformIcons.generic_webhook },
];

/**
 * Get the format that should be used for a given platform
 * Teams always uses JSON for Adaptive Cards
 * Slack and Discord use JSON for their webhook APIs
 * Generic webhook defaults to JSON but could support other formats
 */
export function getPlatformFormat(platform: Platform): 'json' | 'xml' | 'text' {
  switch (platform) {
    case 'teams':
    case 'slack':
    case 'discord':
      return 'json';
    case 'generic_webhook':
    default:
      return 'json'; // Default to JSON, but could be configurable in the future
  }
}

/**
 * Get a human-readable description of what format the platform uses
 */
export function getPlatformFormatDescription(platform: Platform): string {
  switch (platform) {
    case 'teams':
      return 'JSON (Adaptive Cards)';
    case 'slack':
      return 'JSON (Slack API)';
    case 'discord':
      return 'JSON (Discord API)';
    case 'generic_webhook':
      return 'JSON (Recommended)';
    default:
      return 'JSON';
  }
}
