"use server";

import { FieldFilterConfig } from './types';
import { parseStringPromise as xmlToJson } from 'xml2js';

/**
 * Process the XML data using field filtering approach
 * @param input The raw XML input string
 * @param fieldFilter The field filter configuration 
 * @returns Processed data with only the fields specified in the filter
 */
export async function processXmlWithFieldFilter(
  input: string,
  fieldFilter: FieldFilterConfig
): Promise<{ 
  processed: string; 
  extracted: Record<string, string> 
}> {
  try {
    // Parse the XML to object
    const parsedXml = await xmlToJson(input, { 
      explicitArray: false, 
      mergeAttrs: true, 
      explicitRoot: false 
    });
    
    // Check if this is a test notification (special case)
    const isTestNotification = input.trim().startsWith('THIS IS A TEST NOTIFICATION');
    let extractedData: Record<string, string> = {};
    
    if (isTestNotification) {
      extractedData = { 
        TestNotification: "true",
        Message: input.trim()
      };
    } else {
      // Process the parsed XML into a flat structure
      extractedData = flattenXmlObject(parsedXml);
    }
    
    // Apply field filtering
    const filteredData = filterFields(extractedData, fieldFilter);
    
    // Create processed string representation
    const processed = createProcessedOutput(filteredData);
    
    return {
      processed,
      extracted: filteredData
    };
  } catch (error) {
    console.error('Error processing XML with field filter:', error);
    throw new Error(`Failed to process XML: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Convert nested XML object into a flat structure with dot notation for nested fields
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flattenXmlObject(obj: any, prefix: string = ''): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const key in obj) {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (value === null || value === undefined) {
      // Skip null or undefined values
      continue;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Recursively flatten nested objects
      const nested = flattenXmlObject(value, newKey);
      Object.assign(result, nested);
    } else if (Array.isArray(value)) {
      // Handle arrays - convert to string with comma separation
      result[newKey] = value.join(', ');
    } else {
      // Add simple key-value pairs
      result[newKey] = String(value);
    }
  }
  
  return result;
}

/**
 * Apply the field filter to include/exclude fields
 */
function filterFields(
  data: Record<string, string>,
  fieldFilter: FieldFilterConfig
): Record<string, string> {
  const result: Record<string, string> = {};
  
  // If includedFields is empty, include all fields not explicitly excluded
  const includeAllByDefault = fieldFilter.includedFields.length === 0;
  
  for (const key in data) {
    // Skip explicitly excluded fields
    if (fieldFilter.excludedFields.includes(key)) {
      continue;
    }
    
    // Include fields that match the included list or include all if configured
    if (includeAllByDefault || fieldFilter.includedFields.includes(key)) {
      result[key] = data[key];
    }
  }
  
  return result;
}

/**
 * Create a formatted string output from the filtered data
 */
function createProcessedOutput(data: Record<string, string>): string {
  return Object.entries(data)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}

/**
 * Test function to extract fields from sample XML
 * Used by the UI to show available fields for selection
 */
export async function extractFieldsFromXml(input: string): Promise<{
  success: boolean;
  fields: string[];
  extracted: Record<string, string>;
  error?: string;
}> {
  try {
    // Parse the XML to object
    const parsedXml = await xmlToJson(input, { 
      explicitArray: false, 
      mergeAttrs: true, 
      explicitRoot: false 
    });
    
    // Check if this is a test notification (special case)
    const isTestNotification = input.trim().startsWith('THIS IS A TEST NOTIFICATION');
    let extractedData: Record<string, string> = {};
    
    if (isTestNotification) {
      extractedData = { 
        TestNotification: "true",
        Message: input.trim()
      };
    } else {
      // Process the parsed XML into a flat structure
      extractedData = flattenXmlObject(parsedXml);
    }
    
    return {
      success: true,
      fields: Object.keys(extractedData),
      extracted: extractedData
    };
  } catch (error) {
    console.error('Error extracting fields from XML:', error);
    return {
      success: false,
      fields: [],
      extracted: {},
      error: `Failed to extract fields: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
