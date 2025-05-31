import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { LogEntry, LoggedIntegrationAttempt, FieldFilterConfig } from '@/lib/types';
import { processXmlWithFieldFilter } from '@/lib/field-filter-processor';
import { parseXmlToJson, getClientIP, isIPAllowedForEndpoint } from '@/lib/utils';

// Type definitions
type ExtractedData = Record<string, unknown>;

// Platform-specific interfaces
interface TeamsFactSet {
  type: 'FactSet';
  facts: Array<{
    title: string;
    value: string;
  }>;
}

interface TeamsContainer {
  type: 'Container';
  items: Array<TeamsFactSet | TeamsTextBlock>;
  style?: 'emphasis';
  isVisible?: boolean;
}

interface TeamsTextBlock {
  type: 'TextBlock';
  text: string;
  size?: 'Large' | 'Medium';
  weight?: 'Bolder';
  wrap?: boolean;
}

interface TeamsAdaptiveCard {
  type: 'AdaptiveCard';
  $schema: string;
  version: string;
  msteams: { width: 'Full' };
  themeColor: string;
  body: Array<TeamsContainer | TeamsTextBlock>;
}

// Helper functions
function getStatusColor(data: ExtractedData): string {
  const status = ((data.Status || data.status || data.QualitativeNewState || '') + '').toLowerCase();
  const severity = ((data.Severity || data.severity || '') + '').toLowerCase();

  if (status.includes('error') || status.includes('failed') || severity.includes('critical')) {
    return 'attention';
  } else if (status.includes('warn') || severity.includes('warning')) {
    return 'warning';
  } else if (status.includes('ok') || status.includes('success') || status.includes('resolved')) {
    return 'good';
  }
  
  return 'default';
}

function createTeamsCard(data: ExtractedData, fieldFilter: FieldFilterConfig | null = null): TeamsAdaptiveCard {
  const baseCard: TeamsAdaptiveCard = {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    msteams: { width: "Full" },
    themeColor: getStatusColor(data),
    body: [
      {
        type: "TextBlock",
        text: "N-central Notification",
        size: "Large",
        weight: "Bolder",
        wrap: true
      }
    ]
  };

  // Create facts array from filtered data
  const facts: Array<{ title: string; value: string }> = [];
  if (fieldFilter) {
    // Use only included fields from the filter
    for (const field of fieldFilter.includedFields) {
      const value = data[field];
      if (value !== undefined) {
        facts.push({
          title: field,
          value: String(value)
        });
      }
    }
  } else {
    // No filter - include all fields
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && typeof value !== 'object') {
        facts.push({
          title: key,
          value: String(value)
        });
      }
    }
  }

  // Add facts container if we have facts
  if (facts.length > 0) {
    baseCard.body.push({
      type: "Container",
      items: [
        {
          type: "FactSet",
          facts
        }
      ],
      style: "emphasis"
    });
  }

  return baseCard;
}

// Route handlers
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ endpointName: string }> }
) {
  // Await parameters to satisfy Next.js App Router requirements
  const params = await context.params;
  const { endpointName } = params;
  const endpointPathName = endpointName;
  
  // Dynamic import to avoid database initialization during build
  const { 
    getApiEndpointByPath, 
    addRequestLog, 
    getIntegrations: getAllIntegrationsFromDb,
    getFieldFilter
  } = await import('@/lib/db');
  
  const requestHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    requestHeaders[key] = value;
  });

  let xmlPayload = "";
  try {
    xmlPayload = await request.text();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_e) {
    const errorLogEntry: Omit<LogEntry, 'id' | 'timestamp'> = {
        apiEndpointId: "unknown",
        apiEndpointName: "unknown",
        apiEndpointPath: `/api/custom/${endpointPathName}`,
        incomingRequest: {
            ip: getClientIP(request),
            method: request.method,
            headers: requestHeaders,
            bodyRaw: "Failed to read request body",
        },
        processingSummary: {
            overallStatus: 'total_failure',
            message: 'Failed to read request body.',
        },
        integrations: [],
    };
    await addRequestLog(errorLogEntry);
    return NextResponse.json({ error: 'Failed to read request body.' }, { 
      status: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, SOAPAction',
      }
    });
  }

  const currentLogEntryPartial: Omit<LogEntry, 'id' | 'timestamp' | 'processingSummary' | 'integrations'> = {
    apiEndpointId: "unknown", 
    apiEndpointName: "Unknown Endpoint", 
    apiEndpointPath: `/api/custom/${endpointPathName}`,
    incomingRequest: {
        ip: getClientIP(request),
        method: request.method,
        headers: requestHeaders,
        bodyRaw: xmlPayload,
    },
  };

  try {
    const endpointConfig = await getApiEndpointByPath(endpointPathName);
    if (!endpointConfig) {
      console.warn(`API Endpoint not found: /api/custom/${endpointPathName}`);
      await addRequestLog({
        ...currentLogEntryPartial,
        processingSummary: { overallStatus: 'total_failure', message: `API Endpoint '/api/custom/${endpointPathName}' not found.` },
        integrations: []
      });
      return NextResponse.json({ error: `API Endpoint '/api/custom/${endpointPathName}' not found.` }, { 
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, SOAPAction',
        }
      });
    }
    
    currentLogEntryPartial.apiEndpointId = endpointConfig.id;
    currentLogEntryPartial.apiEndpointName = endpointConfig.name;

    // Check IP whitelist for this specific endpoint
    const clientIP = getClientIP(request);
    if (!isIPAllowedForEndpoint(clientIP, endpointConfig.ipWhitelist || [])) {
      console.log(`[${endpointConfig.name}] IP ${clientIP} not in endpoint whitelist`);
      await addRequestLog({
        ...currentLogEntryPartial,
        processingSummary: { 
          overallStatus: 'total_failure', 
          message: `Access denied: IP ${clientIP} is not in the endpoint's whitelist.` 
        },
        integrations: []
      });
      return NextResponse.json({ 
        error: 'Access denied: IP address not in whitelist for this endpoint' 
      }, { 
        status: 403,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, SOAPAction',
        }
      });
    }

    const contentType = request.headers.get('content-type');
    // Allow various XML/SOAP content types that N-Central might send
    const isValidXmlContent = contentType && (
      contentType.includes('application/xml') ||
      contentType.includes('text/xml') ||
      contentType.includes('application/soap+xml') ||
      contentType.includes('application/x-www-form-urlencoded') // Some systems send XML in form data
    );
    
    if (!isValidXmlContent) {
      console.log(`[${endpointConfig.name}] Invalid Content-Type received: ${contentType}`);
      await addRequestLog({
        ...currentLogEntryPartial,
        processingSummary: { overallStatus: 'total_failure', message: `Invalid Content-Type: ${contentType}. Expected XML/SOAP content.` },
        integrations: []
      });
      return NextResponse.json({ 
        error: 'Invalid Content-Type. Expected XML/SOAP content.',
        received: contentType,
        accepted: ['application/xml', 'text/xml', 'application/soap+xml', 'application/x-www-form-urlencoded']
      }, { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, SOAPAction',
        }
      });
    }

    if (!xmlPayload) {
      await addRequestLog({
        ...currentLogEntryPartial,
        processingSummary: { overallStatus: 'total_failure', message: 'Empty payload.' },
        integrations: []
      });
      return NextResponse.json({ error: 'Empty payload.' }, { status: 400 });
    }
    
    const allIntegrations = await getAllIntegrationsFromDb();
    const associatedIntegrationIds = endpointConfig.associatedIntegrationIds; // Already an array

    // Debug log the state of integrations and associations
    console.log('Endpoint Config:', {
      name: endpointConfig.name,
      path: endpointConfig.path,
      associatedIds: associatedIntegrationIds
    });
    console.log('Available Integrations:', allIntegrations.map(int => ({ 
      id: int.id, 
      name: int.name,
      enabled: int.enabled 
    })));

    // First, create logs for all associated integrations regardless of enabled state
    const loggedIntegrationAttempts: LoggedIntegrationAttempt[] = allIntegrations
      .filter(int => associatedIntegrationIds.includes(int.id))
      .map(int => ({
        integrationId: int.id,
        integrationName: int.name,
        platform: int.platform,
        status: int.enabled ? 'failed_transformation' : 'skipped_disabled', // Will be updated later if successful
        webhookUrl: int.webhookUrl,
        errorDetails: int.enabled ? "Processing..." : "Integration is disabled.",
      }));

    // Then, filter to only process enabled integrations
    const integrationsToProcess = allIntegrations.filter(int => {
      const isAssociated = associatedIntegrationIds.includes(int.id);
      const isEnabled = int.enabled;
      console.log(`Integration ${int.name} (${int.id}):`, { isAssociated, isEnabled });
      return isAssociated && isEnabled;
    });

    if (integrationsToProcess.length === 0) {
      await addRequestLog({
        ...currentLogEntryPartial,
        processingSummary: { 
          overallStatus: 'no_integrations_triggered', 
          message: `Notification received for endpoint '${endpointConfig.name}', but no enabled integrations were found to process it.`
        },
        integrations: loggedIntegrationAttempts
      });
      return NextResponse.json({ 
        message: `Notification received for endpoint '${endpointConfig.name}', but no enabled integrations were found to process it.`,
        details: loggedIntegrationAttempts.map(att => ({
          name: att.integrationName, 
          status: att.status, 
          error: att.errorDetails
        }))
      }, { status: 200 });
    }

    let relaySuccessCount = 0;
    
    // Process each enabled integration
    for (const integration of integrationsToProcess) {
      // Find existing log entry created earlier
      const currentAttempt = loggedIntegrationAttempts.find(log => log.integrationId === integration.id);
      if (!currentAttempt) {
        // This shouldn't happen, but if it does, create a new log entry
        loggedIntegrationAttempts.push({
          integrationId: integration.id,
          integrationName: integration.name,
          platform: integration.platform,
          status: 'skipped_disabled',
          webhookUrl: integration.webhookUrl,
        });
        continue;
      }

      let payloadToSend: string | object = xmlPayload;
      // Set default content type to XML but override for JSON-based platforms
      let outgoingContentType = integration.platform === 'teams' ? 'application/json' : 'application/xml';

      try {
        // Parse XML
        const parsedXml = await parseXmlToJson(xmlPayload);

        if (integration.platform === 'teams') {
          // Teams always uses JSON and Adaptive Cards
          let processedData = parsedXml;
          let fieldFilter = null;

          // Get and apply field filter if configured
          if (integration.fieldFilterId) {
            try {
              fieldFilter = await getFieldFilter(integration.fieldFilterId);
              if (!fieldFilter) {
                console.warn(`[${integration.name}] Field filter ${integration.fieldFilterId} not found`);
                currentAttempt.errorDetails = `Warning: Configured field filter not found`;
              } else {
                const { extracted } = await processXmlWithFieldFilter(xmlPayload, fieldFilter);
                processedData = extracted;
              }
            } catch (err) {
              const filterError = err instanceof Error ? err.message : 'Unknown error';
              console.error(`[${integration.name}] Error processing with Field filter:`, filterError);
              currentAttempt.errorDetails = `Error applying field filter: ${filterError}`;
              // Continue with original data if filter fails
            }
          }

          // Create Teams adaptive card with filtered data
          const adaptiveCard = createTeamsCard(processedData, fieldFilter);
          
          // Send the adaptive card
          payloadToSend = {
            type: "message",
            attachments: [
              {
                contentType: "application/vnd.microsoft.card.adaptive",
                content: adaptiveCard
              }
            ]
          };
          outgoingContentType = 'application/json';
          
          // Store the generated payload for logging
          currentAttempt.outgoingPayload = JSON.stringify(payloadToSend);
        } else {
          // Handle other platforms (Discord, Slack, Generic Webhook)
          let processedData = parsedXml;
          let fieldFilter = null;

          // Get and apply field filter if configured
          if (integration.fieldFilterId) {
            try {
              fieldFilter = await getFieldFilter(integration.fieldFilterId);
              if (!fieldFilter) {
                console.warn(`[${integration.name}] Field filter ${integration.fieldFilterId} not found`);
                currentAttempt.errorDetails = `Warning: Configured field filter not found`;
              } else {
                const { extracted } = await processXmlWithFieldFilter(xmlPayload, fieldFilter);
                processedData = extracted;
              }
            } catch (err) {
              const filterError = err instanceof Error ? err.message : 'Unknown error';
              console.error(`[${integration.name}] Error processing with Field filter:`, filterError);
              currentAttempt.errorDetails = `Error applying field filter: ${filterError}`;
              // Continue with original data if filter fails
            }
          }

          // Platform-specific formatting
          if (integration.platform === 'discord') {
            // Discord webhook format - always uses JSON
            const content = `**Notification Received**\n\`\`\`json\n${JSON.stringify(processedData, null, 2)}\n\`\`\``;
            payloadToSend = JSON.stringify({ content });
            outgoingContentType = 'application/json';
          } else if (integration.platform === 'slack') {
            // Slack webhook format - always uses JSON
            const text = `*Notification Received*\n\`\`\`\n${JSON.stringify(processedData, null, 2)}\n\`\`\``;
            payloadToSend = JSON.stringify({ text });
            outgoingContentType = 'application/json';
          } else {
            // Generic webhook - uses JSON format
            payloadToSend = JSON.stringify(processedData, null, 2);
            outgoingContentType = 'application/json';
          }

          // Store the generated payload for logging
          currentAttempt.outgoingPayload = typeof payloadToSend === 'string' ? payloadToSend : JSON.stringify(payloadToSend);
        }

        // Send webhook request for all platforms
        console.log(`[${integration.name}] Sending webhook to: ${integration.webhookUrl}`);
        const webhookResponse = await fetch(integration.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': outgoingContentType,
            'User-Agent': 'NCRelay/1.0',
          },
          body: typeof payloadToSend === 'string' ? payloadToSend : JSON.stringify(payloadToSend),
        });

        currentAttempt.responseStatus = webhookResponse.status;
        currentAttempt.responseBody = await webhookResponse.text();

        if (webhookResponse.ok) {
          currentAttempt.status = 'success';
          currentAttempt.errorDetails = undefined;
          relaySuccessCount++;
          console.log(`[${integration.name}] Webhook delivered successfully`);
        } else {
          currentAttempt.status = 'failed_relay';
          currentAttempt.errorDetails = `HTTP ${webhookResponse.status}: ${currentAttempt.responseBody}`;
          console.error(`[${integration.name}] Webhook failed:`, currentAttempt.errorDetails);
        }

      } catch (processingError) {
        // Handle error in webhook delivery
        currentAttempt.status = 'failed_transformation';
        currentAttempt.errorDetails = processingError instanceof Error 
          ? processingError.message 
          : 'Unknown error during webhook transformation';
        console.error(`[${integration.name}] Error processing webhook:`, currentAttempt.errorDetails);
      }
    }
    
    let overallStatus: LogEntry['processingSummary']['overallStatus'] = 'total_failure';
    if (relaySuccessCount === integrationsToProcess.length && integrationsToProcess.length > 0) {
        overallStatus = 'success';
    } else if (relaySuccessCount > 0) {
        overallStatus = 'partial_failure';
    } else if (integrationsToProcess.length === 0) { 
        overallStatus = 'no_integrations_triggered';
    }

    // Get field filter details for the summary
    const filterDetails = [];
    for (const integration of integrationsToProcess) {
        if (integration.fieldFilterId) {
            const filter = await getFieldFilter(integration.fieldFilterId);
            if (filter) {
                filterDetails.push(`${integration.name}: ${filter.name} (${filter.includedFields.length} fields)`);
            }
        }
    }

    const filterSummary = filterDetails.length > 0 
        ? ` Field filters used: ${filterDetails.join(', ')}.`
        : ' No field filters applied.';

    await addRequestLog({
        ...currentLogEntryPartial,
        processingSummary: {
            overallStatus: overallStatus,
            message: `Processed ${relaySuccessCount}/${integrationsToProcess.length} integrations successfully.${filterSummary}`,
        },
        integrations: loggedIntegrationAttempts,
    });

    return NextResponse.json({ 
      message: `Notification processed for endpoint '${endpointConfig.name}'.`,
      summary: {
        totalIntegrationsAttempted: integrationsToProcess.length,
        successfulRelays: relaySuccessCount,
        failedRelays: integrationsToProcess.length - relaySuccessCount,
      },
      details: loggedIntegrationAttempts.map(att => ({name: att.integrationName, status: att.status, error: att.errorDetails})),
    }, { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, SOAPAction',
      }
    });

  } catch (error) {
    console.error(`Error processing notification for endpoint ${endpointPathName}:`, error);
    const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
     await addRequestLog({
        ...currentLogEntryPartial,
        processingSummary: {
            overallStatus: 'total_failure',
            message: `Internal Server Error: ${errorMessage}`,
        },
        integrations: [],
    });
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ endpointName: string }> }
) {
  // Await parameters to satisfy Next.js App Router requirements
  const params = await context.params;
  const { endpointName } = params;
  const endpointPathName = endpointName;
  
  // Dynamic import to avoid database initialization during build
  const { getApiEndpointByPath } = await import('@/lib/db');
  
  const endpointConfig = await getApiEndpointByPath(endpointPathName);

  if (!endpointConfig) {
    return NextResponse.json({ error: `API Endpoint '/api/custom/${endpointPathName}' not found.` }, { 
      status: 404,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, SOAPAction',
      }
    });
  }
  
  const associatedIds = endpointConfig.associatedIntegrationIds; // Already an array

  const info = {
    message: `NCRelay API endpoint: /api/custom/${endpointPathName}`,
    status: 'OK',
    timestamp: new Date().toISOString(),
    configuration: {
      name: endpointConfig.name,
      path: endpointConfig.path,
      associatedIntegrationsCount: associatedIds.length,
    },
  };
  return NextResponse.json(info, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, SOAPAction',
    }
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, SOAPAction',
    },
  });
}
