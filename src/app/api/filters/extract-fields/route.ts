import { NextRequest, NextResponse } from "next/server";
import { extractFieldsFromXml } from "@/lib/field-filter-processor";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  // Check authentication
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const { input } = await req.json();
    
    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { error: "Invalid request. 'input' is required." }, 
        { status: 400 }
      );
    }
    
    // Extract fields from XML
    const result = await extractFieldsFromXml(input);
    
    if (!result.success) {
      return NextResponse.json(
        { 
          error: "Failed to extract fields from XML", 
          details: result.error 
        }, 
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      fields: result.fields,
      extracted: result.extracted
    });
    
  } catch (error) {
    console.error("Error testing XML field extraction:", error);
    return NextResponse.json(
      { 
        error: "Server error processing XML", 
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
}
