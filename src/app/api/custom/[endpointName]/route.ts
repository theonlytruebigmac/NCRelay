
import { NextResponse, type NextRequest } from 'next/server';
import type { Integration, ApiEndpointConfig, LogEntry, LoggedIntegrationAttempt } from '@/lib/types';
import { parseStringPromise as xmlToJson } from 'xml2js';

function getClientIP(request: NextRequest): string | null {
  // Check common headers for client IP in order of preference
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const remoteAddr = request.headers.get('remote-addr');
  
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }
  
  return realIP || remoteAddr || null;
}

function extractTextFromXml(obj: any, platform: string = 'generic'): string {
  // Check if this is an N-central notification format
  if (obj && typeof obj === 'object') {
    // Priority fields for N-central notifications to create a meaningful message
    const priorityFields = [
      'CustomerName',
      'DeviceName', 
      'AffectedService',
      'QualitativeOldState',
      'QualitativeNewState',
      'QualitativeNewStatus',
      'TimeOfNotification',
      'TimeOfStateChange',
      'DeviceIP',
      'DeviceURI',
      'ProbeURI',
      'TaskName',
      'DeviceDescription',
      'NotificationTriggerName',
      'ActiveProfile',
      'QuantitativeNewState',
      'RemoteControlLink',
      'ServiceOrganizationName'
    ];
    
    let extractedParts: string[] = [];
    
    // Extract priority fields first
    for (const field of priorityFields) {
      if (obj[field] && typeof obj[field] === 'string' && obj[field].trim()) {
        const value = obj[field].trim();
        
        // Format based on platform with specific styling
        let formattedLine = '';
        switch (field) {
          case 'CustomerName':
            switch (platform) {
              case 'discord': formattedLine = `Customer: ${value}`; break;
              case 'teams': formattedLine = `**Customer:** ${value}`; break;
              case 'slack': formattedLine = `*Customer:* ${value}`; break;
              default: formattedLine = `Customer: ${value}`;
            }
            break;
          case 'DeviceName':
            switch (platform) {
              case 'discord': formattedLine = `Device: ${value}`; break;
              case 'teams': formattedLine = `**Device:** ${value}`; break;
              case 'slack': formattedLine = `*Device:* ${value}`; break;
              default: formattedLine = `Device: ${value}`;
            }
            break;
          case 'TaskName':
            switch (platform) {
              case 'discord': formattedLine = `Task: ${value}`; break;
              case 'teams': formattedLine = `**Task:** ${value}`; break;
              case 'slack': formattedLine = `*Task:* ${value}`; break;
              default: formattedLine = `Task: ${value}`;
            }
            break;
          case 'QualitativeOldState':
            switch (platform) {
              case 'discord': formattedLine = `Previous: ${value}`; break;
              case 'teams': formattedLine = `**Previous State:** ${value}`; break;
              case 'slack': formattedLine = `*Previous State:* ${value}`; break;
              default: formattedLine = `Previous State: ${value}`;
            }
            break;
          case 'QualitativeNewState':
          case 'QualitativeNewStatus':
            const isNormal = value.toLowerCase().includes('normal') || value.toLowerCase().includes('ok');
            const isFailed = value.toLowerCase().includes('failed') || value.toLowerCase().includes('error') || value.toLowerCase().includes('critical');
            const isWarning = value.toLowerCase().includes('warning') || value.toLowerCase().includes('warn');
            
            switch (platform) {
              case 'discord': 
                if (isNormal) formattedLine = `Status: ${value}`;
                else if (isFailed) formattedLine = `Status: ${value}`;
                else if (isWarning) formattedLine = `Status: ${value}`;
                else formattedLine = `Status: ${value}`;
                break;
              case 'teams': formattedLine = `**Status:** ${value}`; break;
              case 'slack': formattedLine = `*Status:* ${value}`; break;
              default: formattedLine = `Status: ${value}`;
            }
            break;
          case 'AffectedService':
            switch (platform) {
              case 'discord': formattedLine = `🔧 Service: ${value}`; break;
              case 'teams': formattedLine = `**Service:** ${value}`; break;
              case 'slack': formattedLine = `*Service:* ${value}`; break;
              default: formattedLine = `Service: ${value}`;
            }
            break;
          case 'TimeOfNotification':
          case 'TimeOfStateChange':
            switch (platform) {
              case 'discord': formattedLine = `Time: ${value}`; break;
              case 'teams': formattedLine = `**Time:** ${value}`; break;
              case 'slack': formattedLine = `*Time:* ${value}`; break;
              default: formattedLine = `Time: ${value}`;
            }
            break;
          case 'NotificationTriggerName':
            switch (platform) {
              case 'discord': formattedLine = `Trigger: ${value}`; break;
              case 'teams': formattedLine = `**Trigger:** ${value}`; break;
              case 'slack': formattedLine = `*Trigger:* ${value}`; break;
              default: formattedLine = `Trigger: ${value}`;
            }
            break;
          case 'DeviceIP':
          case 'DeviceURI':
          case 'ProbeURI':
            switch (platform) {
              case 'discord': formattedLine = `IP: ${value}`; break;
              case 'teams': formattedLine = `**IP:** ${value}`; break;
              case 'slack': formattedLine = `*IP:* ${value}`; break;
              default: formattedLine = `IP: ${value}`;
            }
            break;
          case 'ActiveProfile':
            switch (platform) {
              case 'discord': formattedLine = `Profile: ${value}`; break;
              case 'teams': formattedLine = `**Profile:** ${value}`; break;
              case 'slack': formattedLine = `*Profile:* ${value}`; break;
              default: formattedLine = `Profile: ${value}`;
            }
            break;
          case 'QuantitativeNewState':
            // Truncate long quantitative data for readability
            const truncatedValue = value.length > 200 ? value.substring(0, 200) + '...' : value;
            switch (platform) {
              case 'discord': formattedLine = `Details:\n\`\`\`\n${truncatedValue}\n\`\`\``; break;
              case 'teams': formattedLine = `**Details:**\n\`\`\`\n${truncatedValue}\n\`\`\``; break;
              case 'slack': formattedLine = `*Details:*\n\`\`\`\n${truncatedValue}\n\`\`\``; break;
              default: formattedLine = `Details: ${truncatedValue}`;
            }
            break;
          case 'RemoteControlLink':
            switch (platform) {
              case 'discord': formattedLine = `[Remote Control](${value})`; break;
              case 'teams': formattedLine = `**Remote Control:** [Access Device](${value})`; break;
              case 'slack': formattedLine = `*Remote Control:* <${value}|Access Device>`; break;
              default: formattedLine = `Remote Control: ${value}`;
            }
            break;
          case 'DeviceDescription':
            switch (platform) {
              case 'discord': formattedLine = `Description: ${value}`; break;
              case 'teams': formattedLine = `**Description:** ${value}`; break;
              case 'slack': formattedLine = `*Description:* ${value}`; break;
              default: formattedLine = `Description: ${value}`;
            }
            break;
          case 'ServiceOrganizationName':
            switch (platform) {
              case 'discord': formattedLine = `Organization: ${value}`; break;
              case 'teams': formattedLine = `**Organization:** ${value}`; break;
              case 'slack': formattedLine = `*Organization:* ${value}`; break;
              default: formattedLine = `Organization: ${value}`;
            }
            break;
          default:
            switch (platform) {
              case 'teams': formattedLine = `**${field}:** ${value}`; break;
              case 'slack': formattedLine = `*${field}:* ${value}`; break;
              default: formattedLine = `${field}: ${value}`;
            }
        }
        extractedParts.push(formattedLine);
      }
    }
    
    if (extractedParts.length > 0) {
      // Format the output based on platform with proper headers
      let header = '';
      let separator = '\n';
      
      switch (platform) {
        case 'teams':
          header = '## N-Central Alert\n\n';
          break;
        case 'slack':
          header = ':warning: *N-Central Alert*\n\n';
          break;
        case 'discord':
          header = '**N-Central Alert**\n';
          break;
        default:
          header = 'N-Central Alert\n';
      }
      
      return header + extractedParts.join(separator);
    }
  }
  
  // Fallback to generic extraction for non N-central formats
  let text = '';
  function recurse(current: any) {
    if (typeof current === 'string' && current.trim()) {
      text += current.trim() + ' ';
    } else if (Array.isArray(current)) {
      current.forEach(recurse);
    } else if (typeof current === 'object' && current !== null) {
      // Handle CDATA and text content
      if (current['_'] && typeof current['_'] === 'string' && current['_'].trim()) {
        text += current['_'].trim() + ' ';
      }
      
      // Recurse through object properties, skipping XML attributes ($)
      for (const key in current) {
        if (key !== '$' && key !== '_') {
          recurse(current[key]);
        }
      }
    }
  }
  recurse(obj);
  const result = text.trim();
  
  // Final fallback: if no text extracted, try to stringify the object
  if (!result && obj) {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return 'Unable to extract content from XML';
    }
  }
  
  return result || 'No content found in XML';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ endpointName: string }> }
) {
  const { endpointName } = await params;
  const endpointPathName = endpointName; 
  
  // Dynamic import to avoid database initialization during build
  const { getApiEndpointByPath, addRequestLog, getIntegrations: getAllIntegrationsFromDb } = await import('@/lib/db');
  
  const requestHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    requestHeaders[key] = value;
  });

  let xmlPayload = "";
  try {
    xmlPayload = await request.text();
  } catch (e) {
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
    const { getApiEndpointByPath, addRequestLog, getIntegrations: getAllIntegrationsFromDb } = await import('@/lib/db');
    
    const endpointConfig = await getApiEndpointByPath(endpointPathName);

    if (!endpointConfig) {
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

    const integrationsToProcess = allIntegrations.filter(
      int => associatedIntegrationIds.includes(int.id) && int.enabled
    );

    const loggedIntegrationAttempts: LoggedIntegrationAttempt[] = [];

    if (integrationsToProcess.length === 0) {
       const skippedIntegrationsLog: LoggedIntegrationAttempt[] = allIntegrations
          .filter(int => associatedIntegrationIds.includes(int.id)) 
          .map(int => ({
            integrationId: int.id,
            integrationName: int.name,
            platform: int.platform,
            status: int.enabled ? 'skipped_no_association' : 'skipped_disabled', 
            targetFormat: int.targetFormat,
            webhookUrl: int.webhookUrl,
            errorDetails: int.enabled ? "No enabled integrations found for this endpoint or other configuration issue." : "Integration disabled.",
          }));

      await addRequestLog({
        ...currentLogEntryPartial,
        processingSummary: { overallStatus: 'no_integrations_triggered', message: `Notification received for endpoint '${endpointConfig.name}', but no enabled integrations are associated or found.`},
        integrations: skippedIntegrationsLog 
      });
      return NextResponse.json({ message: `Notification received for endpoint '${endpointConfig.name}', but no enabled integrations are associated or found.` }, { status: 200 });
    }

    let relaySuccessCount = 0;
    
    for (const integration of integrationsToProcess) {
      let payloadToSend: string | object = xmlPayload;
      let outgoingContentType = 'application/xml'; 
      const currentAttempt: LoggedIntegrationAttempt = {
          integrationId: integration.id,
          integrationName: integration.name,
          platform: integration.platform,
          status: 'skipped_disabled', 
          targetFormat: integration.targetFormat,
          webhookUrl: integration.webhookUrl,
      };

      try {
        console.log(`[${integration.name}] Processing XML payload for ${integration.platform} (${integration.targetFormat} format)`);
        console.log(`[${integration.name}] Raw XML payload:`, xmlPayload.substring(0, 500) + (xmlPayload.length > 500 ? '...' : ''));
        
        const parsedXml = await xmlToJson(xmlPayload, { explicitArray: false, mergeAttrs: true, explicitRoot: false });
        console.log(`[${integration.name}] Parsed XML object:`, JSON.stringify(parsedXml, null, 2));
        
        if (integration.targetFormat === 'text') {
          const extractedText = extractTextFromXml(parsedXml, integration.platform);
          console.log(`[${integration.name}] Extracted text from XML:`, `"${extractedText}" (length: ${extractedText.length})`);
          
          if (integration.platform === 'slack') {
            payloadToSend = JSON.stringify({ text: extractedText });
            outgoingContentType = 'application/json';
          } else if (integration.platform === 'discord') {
            payloadToSend = JSON.stringify({ content: extractedText });
            outgoingContentType = 'application/json';
            console.log(`[${integration.name}] Discord payload:`, payloadToSend);
          } else if (integration.platform === 'teams') {
             payloadToSend = JSON.stringify({ text: extractedText });
             outgoingContentType = 'application/json';
          } else { 
            payloadToSend = extractedText;
            outgoingContentType = 'text/plain';
          }
        } else if (integration.targetFormat === 'json') {
          if (integration.platform === 'discord') {
            // For Discord JSON format, convert the parsed XML to a content field
            const jsonContent = JSON.stringify(parsedXml, null, 2);
            payloadToSend = JSON.stringify({ content: `\`\`\`json\n${jsonContent}\n\`\`\`` });
          } else if (integration.platform === 'slack') {
            // For Slack JSON format, use text field with code block
            const jsonContent = JSON.stringify(parsedXml, null, 2);
            payloadToSend = JSON.stringify({ text: `\`\`\`json\n${jsonContent}\n\`\`\`` });
          } else {
            // For other platforms, send raw JSON
            payloadToSend = JSON.stringify(parsedXml, null, 2);
          }
          outgoingContentType = 'application/json';
        }
        currentAttempt.outgoingPayload = typeof payloadToSend === 'string' ? payloadToSend : JSON.stringify(payloadToSend);
        console.log(`[${integration.name}] Final payload to send:`, currentAttempt.outgoingPayload);
      
      } catch (error) {
        console.error(`Error transforming XML for integration ${integration.name} on endpoint ${endpointConfig.name}:`, error);
        currentAttempt.status = 'failed_transformation';
        currentAttempt.errorDetails = (error as Error).message;
        loggedIntegrationAttempts.push(currentAttempt);
        continue; 
      }

      try {
        const response = await fetch(integration.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': outgoingContentType },
          body: typeof payloadToSend === 'string' ? payloadToSend : JSON.stringify(payloadToSend),
        });

        currentAttempt.responseStatus = response.status;
        try {
            currentAttempt.responseBody = await response.text();
        } catch (respBodyError) {
            currentAttempt.responseBody = "Could not read response body.";
        }

        if (!response.ok) {
          throw new Error(`Webhook failed with status ${response.status}: ${currentAttempt.responseBody}`);
        }
        currentAttempt.status = 'success';
        relaySuccessCount++;
      } catch (error) {
        console.error(`Error relaying to ${integration.name} (via ${endpointConfig.name}):`, error);
        currentAttempt.status = 'failed_relay';
        currentAttempt.errorDetails = (error as Error).message;
      }
      loggedIntegrationAttempts.push(currentAttempt);
    }
    
    let overallStatus: LogEntry['processingSummary']['overallStatus'] = 'total_failure';
    if (relaySuccessCount === integrationsToProcess.length && integrationsToProcess.length > 0) {
        overallStatus = 'success';
    } else if (relaySuccessCount > 0) {
        overallStatus = 'partial_failure';
    } else if (integrationsToProcess.length === 0) { 
        overallStatus = 'no_integrations_triggered';
    }


    await addRequestLog({
        ...currentLogEntryPartial,
        processingSummary: {
            overallStatus: overallStatus,
            message: `Processed ${relaySuccessCount}/${integrationsToProcess.length} integrations successfully.`,
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
  { params }: { params: Promise<{ endpointName: string }> }
) {
  const { endpointName } = await params;
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

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, SOAPAction',
    },
  });
}

    