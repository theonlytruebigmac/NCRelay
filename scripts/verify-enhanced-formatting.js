#!/usr/bin/env node

/**
 * Enhanced Formatting Verification Script
 * 
 * This script demonstrates the enhanced message formatting system
 * with sample N-Central data and shows the output for each platform.
 */

const path = require('path');
const { formatSlackMessage } = require('./src/lib/slack-formatter.ts');

// Sample N-Central failure notification
const failureData = {
  DeviceName: 'SRV-PROD-01',
  QualitativeNewState: 'Failed',
  QualitativeOldState: 'Normal',
  TaskIdent: 'DISK_SPACE_CHECK_C',
  TimeOfStateChange: '2024-01-15T14:30:00Z',
  NCentralURI: 'https://ncentral.company.com',
  CustomerName: 'Acme Corporation',
  LongMessage: 'Disk space on C:\\ has exceeded 85% threshold. Current usage: 92%',
  ThresholdValue: '85',
  CurrentValue: '92',
  ProbeURI: 'https://probe.company.com/device/123',
  AffectedService: 'File System Monitor'
};

// Sample N-Central recovery notification
const recoveryData = {
  DeviceName: 'SRV-PROD-01',
  QualitativeNewState: 'Normal',
  QualitativeOldState: 'Failed',
  TaskIdent: 'DISK_SPACE_CHECK_C',
  TimeOfStateChange: '2024-01-15T15:45:00Z',
  CustomerName: 'Acme Corporation',
  LongMessage: 'Disk space on C:\\ has returned to normal levels. Current usage: 78%',
  CurrentValue: '78'
};

// Sample warning notification
const warningData = {
  DeviceName: 'SRV-TEST-02',
  QualitativeNewState: 'Warning',
  TaskIdent: 'CPU_USAGE_CHECK',
  CustomerName: 'Beta Corp',
  LongMessage: 'CPU usage elevated but not critical. Current: 75%',
  CurrentValue: '75',
  ThresholdValue: '80'
};

// Helper functions for other platforms (from route)
function getStatusColor(data) {
  const qualitativeNewState = ((data.QualitativeNewState || '') + '').toLowerCase();
  if (qualitativeNewState) {
    if (qualitativeNewState === 'failed' || qualitativeNewState === 'failure') {
      return 'attention';
    }
    if (qualitativeNewState === 'normal' || qualitativeNewState === 'ok') {
      return 'good';
    }
    if (qualitativeNewState === 'warning' || qualitativeNewState === 'warn') {
      return 'warning';
    }
  }
  return 'default';
}

function getDiscordEmbedColor(data) {
  const qualitativeNewState = ((data.QualitativeNewState || '') + '').toLowerCase();
  if (qualitativeNewState) {
    if (qualitativeNewState === 'failed' || qualitativeNewState === 'failure') {
      return 0xff0000;
    }
    if (qualitativeNewState === 'normal' || qualitativeNewState === 'ok') {
      return 0x00ff00;
    }
    if (qualitativeNewState === 'warning' || qualitativeNewState === 'warn') {
      return 0xffaa00;
    }
  }
  return 0x36a64f;
}

function displayResults(title, data) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${title}`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    // Slack formatting
    const slackMessage = formatSlackMessage(data);
    console.log('\n📱 SLACK:');
    console.log(`   Color: ${slackMessage.attachments?.[0]?.color || 'default'}`);
    console.log(`   Title: ${slackMessage.text || 'N/A'}`);
    console.log(`   Fields: ${(slackMessage.attachments?.[0]?.fields || []).length} fields`);
    
    // Show first few fields as sample
    const fields = slackMessage.attachments?.[0]?.fields || [];
    fields.slice(0, 3).forEach(field => {
      console.log(`     • ${field.title}: ${field.value}`);
    });
    if (fields.length > 3) {
      console.log(`     • ... and ${fields.length - 3} more fields`);
    }
    
    // Teams formatting
    const teamsColor = getStatusColor(data);
    console.log('\n🟦 TEAMS:');
    console.log(`   Color: ${teamsColor}`);
    console.log(`   Theme: ${teamsColor === 'attention' ? 'Red' : teamsColor === 'good' ? 'Green' : teamsColor === 'warning' ? 'Yellow' : 'Default'}`);
    
    // Discord formatting
    const discordColor = getDiscordEmbedColor(data);
    console.log('\n🎮 DISCORD:');
    console.log(`   Color: 0x${discordColor.toString(16).padStart(6, '0').toUpperCase()}`);
    console.log(`   RGB: ${discordColor === 0xff0000 ? 'Red' : discordColor === 0x00ff00 ? 'Green' : discordColor === 0xffaa00 ? 'Orange' : 'Default Green'}`);
    
  } catch (error) {
    console.error(`❌ Error processing ${title}:`, error.message);
  }
}

function main() {
  console.log('🚀 Enhanced Message Formatting Verification');
  console.log('Testing N-Central notification formatting across all platforms...\n');
  
  displayResults('FAILURE NOTIFICATION', failureData);
  displayResults('RECOVERY NOTIFICATION', recoveryData);
  displayResults('WARNING NOTIFICATION', warningData);
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ Enhanced formatting verification complete!');
  console.log('\nKey Features Demonstrated:');
  console.log('• QualitativeNewState priority for color coding');
  console.log('• N-Central field extraction and formatting');
  console.log('• Cross-platform consistency');
  console.log('• Proper field mapping and display');
  console.log(`${'='.repeat(60)}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  displayResults,
  getStatusColor,
  getDiscordEmbedColor
};
