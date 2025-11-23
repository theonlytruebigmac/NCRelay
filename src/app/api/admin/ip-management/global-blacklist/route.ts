import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permission-middleware";
import {
  getGlobalBlacklist,
  addToGlobalBlacklist,
  removeFromGlobalBlacklist,
} from "@/lib/ip-access-control";
import { z } from "zod";

const BlacklistSchema = z.object({
  ipAddress: z
    .string()
    .regex(
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
      "Invalid IPv4 address"
    ),
  reason: z.string().min(1, "Reason is required"),
  isPermanent: z.boolean(),
  durationMinutes: z.number().min(1).optional(),
});

// GET /api/admin/ip-management/global-blacklist
export async function GET(request: NextRequest) {
  try {
    const permission = await requirePermission("settings", "read");

    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.reason || "Access denied" },
        { status: 403 }
      );
    }

    const entries = await getGlobalBlacklist();
    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Error fetching global blacklist:", error);
    return NextResponse.json(
      { error: "Failed to fetch global blacklist" },
      { status: 500 }
    );
  }
}

// POST /api/admin/ip-management/global-blacklist
export async function POST(request: NextRequest) {
  try {
    const permission = await requirePermission("settings", "manage", {
      logAction: true,
    });

    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.reason || "Access denied" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = BlacklistSchema.parse(body);

    let expiresAt: string | undefined;
    if (!validatedData.isPermanent && validatedData.durationMinutes) {
      expiresAt = new Date(
        Date.now() + validatedData.durationMinutes * 60 * 1000
      ).toISOString();
    }

    await addToGlobalBlacklist(
      validatedData.ipAddress,
      validatedData.reason,
      validatedData.isPermanent,
      expiresAt,
      permission.user!.id
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error adding to global blacklist:", error);
    return NextResponse.json(
      { error: "Failed to add to global blacklist" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/ip-management/global-blacklist/[ipAddress]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ ipAddress: string }> }
) {
  try {
    const permission = await requirePermission("settings", "manage", {
      logAction: true,
    });

    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.reason || "Access denied" },
        { status: 403 }
      );
    }

    const { ipAddress } = await params;
    await removeFromGlobalBlacklist(decodeURIComponent(ipAddress));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing from global blacklist:", error);
    return NextResponse.json(
      { error: "Failed to remove from global blacklist" },
      { status: 500 }
    );
  }
}
