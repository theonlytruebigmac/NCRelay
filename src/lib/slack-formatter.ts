/**
 * Slack message formatting utilities
 * Creates rich, formatted messages for Slack webhooks
 */

export interface SlackField {
  title: string;
  value: string;
  short?: boolean;
}

export interface SlackAttachment {
  color?: string;
  title?: string;
  text?: string;
  fields?: SlackField[];
  footer?: string;
  ts?: number;
}

export interface SlackMessage {
  text?: string;
  attachments?: SlackAttachment[];
  blocks?: any[]; // Slack Block Kit blocks
}

/**
 * Formats XML/JSON data into a nice Slack message
 */
export function formatSlackMessage(data: Record<string, any>): SlackMessage {
  // Extract common fields that might be present in alerts/notifications
  const title = extractTitle(data);
  const message = extractMessage(data);
  const severity = extractSeverity(data);
  const timestamp = extractTimestamp(data);
  
  // Create the main message text
  const mainText = title || "Notification Received";
  
  // Create attachment with appropriate color based on severity
  const color = getSeverityColor(severity);
  
  // Extract key fields for display
  const fields = extractImportantFields(data);
  
  const attachment: SlackAttachment = {
    color,
    title: title !== mainText ? title : undefined,
    text: message,
    fields,
    footer: "NCRelay",
    ts: timestamp ? new Date(timestamp).getTime() / 1000 : Math.floor(Date.now() / 1000)
  };

  return {
    text: mainText,
    attachments: [attachment]
  };
}

/**
 * Extract title from various possible field names
 */
function extractTitle(data: Record<string, any>): string | undefined {
  const titleFields = [
    'title', 'alertTitle', 'alert_title', 'name', 'alertName', 'alert_name',
    'subject', 'summary', 'deviceName', 'device_name', 'devicename'
  ];
  
  for (const field of titleFields) {
    const value = getNestedValue(data, field);
    if (value && typeof value === 'string') {
      return value;
    }
  }
  return undefined;
}

/**
 * Extract message/description from various possible field names
 */
function extractMessage(data: Record<string, any>): string | undefined {
  const messageFields = [
    'message', 'description', 'alertMessage', 'alert_message', 'alertmessage',
    'text', 'body', 'details', 'longDescription', 'long_description'
  ];
  
  for (const field of messageFields) {
    const value = getNestedValue(data, field);
    if (value && typeof value === 'string') {
      return value;
    }
  }
  return undefined;
}

/**
 * Extract severity/priority from various possible field names
 */
function extractSeverity(data: Record<string, any>): string | undefined {
  const severityFields = [
    'QualitativeNewState', 'qualitativeNewState', 'qualitative_new_state',
    'severity', 'priority', 'level', 'alertSeverity', 'alert_severity',
    'state', 'status', 'criticality'
  ];
  
  for (const field of severityFields) {
    const value = getNestedValue(data, field);
    if (value && typeof value === 'string') {
      return value.toLowerCase();
    }
  }
  return undefined;
}

/**
 * Extract timestamp from various possible field names
 */
function extractTimestamp(data: Record<string, any>): string | undefined {
  const timestampFields = [
    'timestamp', 'time', 'createdAt', 'created_at', 'alertTime', 'alert_time',
    'timeOfStateChange', 'TimeOfStateChange', 'eventTime', 'event_time'
  ];
  
  for (const field of timestampFields) {
    const value = getNestedValue(data, field);
    if (value && (typeof value === 'string' || typeof value === 'number')) {
      return value.toString();
    }
  }
  return undefined;
}

/**
 * Extract important fields for display in attachment
 */
function extractImportantFields(data: Record<string, any>): SlackField[] {
  const fields: SlackField[] = [];
  
  // Define important field mappings
  const fieldMappings: Array<{
    titles: string[];
    displayName: string;
    short?: boolean;
  }> = [
    {
      titles: ['deviceName', 'device_name', 'devicename', 'host', 'hostname'],
      displayName: 'Device',
      short: true
    },
    {
      titles: ['customerName', 'customer_name', 'customername', 'customer'],
      displayName: 'Customer',
      short: true
    },
    {
      titles: ['QualitativeNewState', 'qualitativeNewState', 'qualitative_new_state', 'severity', 'priority', 'level'],
      displayName: 'Qualitative New State',
      short: true
    },
    {
      titles: ['QualitativeOldState', 'qualitativeOldState', 'qualitative_old_state'],
      displayName: 'Qualitative Old State',
      short: true
    },
    {
      titles: ['state', 'status', 'alertState', 'alert_state'],
      displayName: 'Status',
      short: true
    },
    {
      titles: ['deviceURI', 'device_uri', 'deviceuri', 'uri', 'DeviceURI'],
      displayName: 'Device URI',
      short: true
    },
    {
      titles: ['affectedService', 'affected_service', 'service', 'AffectedService'],
      displayName: 'Service',
      short: true
    },
    {
      titles: ['taskIdent', 'task_ident', 'taskid', 'TaskIdent'],
      displayName: 'Task Ident',
      short: true
    },
    {
      titles: ['probeURI', 'probe_uri', 'ProbeURI'],
      displayName: 'Probe URI',
      short: true
    },
    {
      titles: ['NCentralURI', 'ncentral_uri', 'ncentraluri'],
      displayName: 'N-Central URI',
      short: true
    },
    {
      titles: ['TimeOfStateChange', 'time_of_state_change', 'timeOfStateChange'],
      displayName: 'Time of State Change',
      short: true
    },
    {
      titles: ['QuantitativeNewState', 'quantitative_new_state', 'quantitativeNewState'],
      displayName: 'Quantitative New State',
      short: true
    },
    {
      titles: ['ExternalCustomerID', 'external_customer_id', 'externalCustomerId'],
      displayName: 'External Customer ID',
      short: true
    },
    {
      titles: ['ActiveNotificationTriggerID', 'active_notification_trigger_id', 'activeNotificationTriggerId'],
      displayName: 'Notification Trigger ID',
      short: true
    }
  ];

  for (const mapping of fieldMappings) {
    for (const fieldName of mapping.titles) {
      const value = getNestedValue(data, fieldName);
      if (value && typeof value === 'string' && value.trim()) {
        fields.push({
          title: mapping.displayName,
          value: formatFieldValue(value),
          short: mapping.short
        });
        break; // Found value, move to next mapping
      }
    }
  }

  // Add any remaining interesting fields (but limit total fields)
  if (fields.length < 15) {
    const remainingFields = Object.entries(data)
      .filter(([key, value]) => 
        (typeof value === 'string' || typeof value === 'number') && 
        String(value).length < 200 && 
        !isAlreadyIncluded(key, fields) &&
        !isCommonIgnoredField(key)
      )
      .slice(0, 15 - fields.length);

    for (const [key, value] of remainingFields) {
      fields.push({
        title: formatFieldName(key),
        value: formatFieldValue(String(value)),
        short: String(value).length < 50
      });
    }
  }

  return fields;
}

/**
 * Get color based on severity level
 */
export function getSeverityColor(severity?: string): string {
  if (!severity) return '#36a64f'; // Green for unknown/info
  
  const sev = severity.toLowerCase();
  
  // Check for QualitativeNewState specific values first
  if (sev === 'failed' || sev === 'failure') {
    return '#ff0000'; // Red for Failed
  }
  if (sev === 'normal' || sev === 'ok') {
    return '#36a64f'; // Green for Normal/OK
  }
  if (sev === 'warning' || sev === 'warn') {
    return '#ffaa00'; // Yellow/Orange for Warning
  }
  
  // Fallback to general severity checks
  if (sev.includes('critical') || sev.includes('high') || sev.includes('error') || sev.includes('red')) {
    return '#ff0000'; // Red
  }
  if (sev.includes('warning') || sev.includes('medium') || sev.includes('warn') || sev.includes('yellow')) {
    return '#ffaa00'; // Orange
  }
  if (sev.includes('info') || sev.includes('low') || sev.includes('normal') || sev.includes('green')) {
    return '#36a64f'; // Green
  }
  
  return '#36a64f'; // Default green
}

/**
 * Get nested value from object using dot notation or direct key
 */
function getNestedValue(obj: Record<string, any>, key: string): any {
  if (obj[key] !== undefined) {
    return obj[key];
  }
  
  // Try case-insensitive match
  const lowerKey = key.toLowerCase();
  for (const [objKey, value] of Object.entries(obj)) {
    if (objKey.toLowerCase() === lowerKey) {
      return value;
    }
  }
  
  return undefined;
}

/**
 * Check if a field is already included in the fields array
 */
function isAlreadyIncluded(key: string, fields: SlackField[]): boolean {
  const lowerKey = key.toLowerCase();
  return fields.some(field => 
    field.title.toLowerCase().includes(lowerKey) || 
    lowerKey.includes(field.title.toLowerCase())
  );
}

/**
 * Check if this is a commonly ignored field
 */
function isCommonIgnoredField(key: string): boolean {
  const ignoredFields = [
    'id', '_id', 'uuid', 'guid',
    'version', 'schema', 'encoding',
    'raw', 'original', 'internal',
    'created', 'updated', 'modified'
  ];
  
  const lowerKey = key.toLowerCase();
  return ignoredFields.some(ignored => lowerKey.includes(ignored));
}

/**
 * Format field name for display
 */
function formatFieldName(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1') // Add space before capitals
    .replace(/[_-]/g, ' ') // Replace underscores and hyphens with spaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

/**
 * Format field value for display
 */
function formatFieldValue(value: string): string {
  // Truncate very long values
  if (value.length > 200) {
    return value.substring(0, 197) + '...';
  }
  
  // Format URLs
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return `<${value}|View>`;
  }
  
  return value;
}

/**
 * Create a fallback message when formatting fails
 */
export function createFallbackSlackMessage(data: Record<string, any>): SlackMessage {
  return {
    text: "Notification Received",
    attachments: [{
      color: "#36a64f",
      title: "Raw Data",
      text: "```\n" + JSON.stringify(data, null, 2) + "\n```",
      footer: "NCRelay",
      ts: Math.floor(Date.now() / 1000)
    }]
  };
}
