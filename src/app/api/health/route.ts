import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET(_request: NextRequest) {
  // Skip health check during build
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json(
      { status: "ok", message: "Build phase - health check skipped" },
      { status: 200 }
    );
  }

  try {
    // Test database connection
    const db = await getDB();
    const result = db.prepare("SELECT 1").get();
    
    if (!result) {
      throw new Error("Database query failed");
    }

    return NextResponse.json(
      { status: "ok", message: "Service is healthy" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      { status: "error", message: "Service is unhealthy" },
      { status: 503 }
    );
  }
}
