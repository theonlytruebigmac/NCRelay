
import { NextResponse, type NextRequest } from 'next/server';
import type { Integration, ApiEndpointConfig, LogEntry, LoggedIntegrationAttempt } from '@/lib/types';
import { parseStringPromise as xmlToJson } from 'xml2js';
import { getApiEndpointByPath, addRequestLog, getIntegrations as getAllIntegrationsFromDb } from '@/lib/db';


function extractTextFromXml(obj: any): string {
  let text = '';
  function recurse(current: any) {
    if (typeof current === 'string') {
      text += current.trim() + ' ';
    } else if (Array.isArray(current)) {
      current.forEach(recurse);
    } else if (typeof current === 'object' && current !== null) {
      if (current['_'] && typeof current['_'] === 'string' && current['_'].trim() !== '' && Object.keys(current).length === 1) {
         text += current['_'].trim() + ' ';
      } else {
        for (const key in current) {
          if (key !== '$') { 
            recurse(current[key]);
          }
        }
      }
    }
  }
  recurse(obj);
  return text.trim();
}

export async function POST(
  request: NextRequest,
  { params }: { params: { endpointName: string } }
) {
  const endpointPathName = params.endpointName; 
  
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
            ip: request.ip ?? request.headers.get('x-forwarded-for') ?? null,
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
    return NextResponse.json({ error: 'Failed to read request body.' }, { status: 400 });
  }

  const currentLogEntryPartial: Omit<LogEntry, 'id' | 'timestamp' | 'processingSummary' | 'integrations'> = {
    apiEndpointId: "unknown", 
    apiEndpointName: "Unknown Endpoint", 
    apiEndpointPath: `/api/custom/${endpointPathName}`,
    incomingRequest: {
        ip: request.ip ?? request.headers.get('x-forwarded-for') ?? null,
        method: request.method,
        headers: requestHeaders,
        bodyRaw: xmlPayload,
    },
  };

  try {
    const endpointConfig = await getApiEndpointByPath(endpointPathName);

    if (!endpointConfig) {
      await addRequestLog({
        ...currentLogEntryPartial,
        processingSummary: { overallStatus: 'total_failure', message: `API Endpoint '/api/custom/${endpointPathName}' not found.` },
        integrations: []
      });
      return NextResponse.json({ error: `API Endpoint '/api/custom/${endpointPathName}' not found.` }, { status: 404 });
    }
    
    currentLogEntryPartial.apiEndpointId = endpointConfig.id;
    currentLogEntryPartial.apiEndpointName = endpointConfig.name;

    const contentType = request.headers.get('content-type');
    if (!contentType || (!contentType.includes('application/xml') && !contentType.includes('text/xml'))) {
      await addRequestLog({
        ...currentLogEntryPartial,
        processingSummary: { overallStatus: 'total_failure', message: 'Invalid Content-Type. Expected XML.' },
        integrations: []
      });
      return NextResponse.json({ error: 'Invalid Content-Type. Expected XML.' }, { status: 400 });
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
        const parsedXml = await xmlToJson(xmlPayload, { explicitArray: false, mergeAttrs: true, explicitRoot: false });
        
        if (integration.targetFormat === 'text') {
          const extractedText = extractTextFromXml(parsedXml);
          if (integration.platform === 'slack') {
            payloadToSend = JSON.stringify({ text: extractedText });
            outgoingContentType = 'application/json';
          } else if (integration.platform === 'discord') {
            payloadToSend = JSON.stringify({ content: extractedText });
            outgoingContentType = 'application/json';
          } else if (integration.platform === 'teams') {
             payloadToSend = JSON.stringify({ text: extractedText });
             outgoingContentType = 'application/json';
          } else { 
            payloadToSend = extractedText;
            outgoingContentType = 'text/plain';
          }
        } else if (integration.targetFormat === 'json') {
          payloadToSend = JSON.stringify(parsedXml, null, 2); 
          outgoingContentType = 'application/json';
        }
        currentAttempt.outgoingPayload = typeof payloadToSend === 'string' ? payloadToSend : JSON.stringify(payloadToSend);
      
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
    }, { status: 200 });

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
  { params }: { params: { endpointName: string } }
) {
  const endpointPathName = params.endpointName;
  const endpointConfig = await getApiEndpointByPath(endpointPathName);

  if (!endpointConfig) {
    return NextResponse.json({ error: `API Endpoint '/api/custom/${endpointPathName}' not found.` }, { status: 404 });
  }
  
  const associatedIds = endpointConfig.associatedIntegrationIds; // Already an array

  const info = {
    message: `RelayZen API endpoint: /api/custom/${endpointPathName}`,
    status: 'OK',
    timestamp: new Date().toISOString(),
    configuration: {
      name: endpointConfig.name,
      path: endpointConfig.path,
      associatedIntegrationsCount: associatedIds.length,
    },
  };
  return NextResponse.json(info);
}

    