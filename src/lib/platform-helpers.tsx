
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
