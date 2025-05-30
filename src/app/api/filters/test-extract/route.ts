import { NextRequest, NextResponse } from "next/server";
import { processXmlWithFieldFilter } from "@/lib/field-filter-processor";
import { getCurrentUser } from "@/lib/auth";
import type { FieldFilterConfig } from "@/lib/types";

export async function POST(request: NextRequest) {
  // Check authentication
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const { xmlData, includedFields, excludedFields } = await request.json();

    if (!xmlData) {
      return NextResponse.json(
        { error: "XML data is required" },
        { status: 400 }
      );
    }

    // Create a temporary filter config for testing
    const tempFilter: FieldFilterConfig = {
      id: "temp",
      name: "Temporary Test Filter",
      includedFields: includedFields || [],
      excludedFields: excludedFields || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Process the XML with the temporary filter
    const result = await processXmlWithFieldFilter(xmlData, tempFilter);

    return NextResponse.json({
      success: true,
      processed: result.processed,
      extracted: result.extracted,
      fields: Object.keys(result.extracted).sort(),
    });
  } catch (error) {
    console.error("Error testing field extraction:", error);
    return NextResponse.json(
      { error: "Failed to process XML data" },
      { status: 500 }
    );
  }
}
