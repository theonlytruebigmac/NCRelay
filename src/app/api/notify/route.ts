// This file is deprecated and will be removed.
// All API traffic should now go through /api/custom/[endpointName]

import { NextResponse, type NextRequest } from 'next/server';

export async function POST(_request: NextRequest) {
  return NextResponse.json({ 
    error: 'This endpoint (/api/notify) is deprecated. Please use custom API endpoints configured under /api/custom/[yourEndpointPath].' 
  }, { status: 410 }); // 410 Gone
}

export async function GET(_request: NextRequest) {
   return NextResponse.json({ 
    message: 'This endpoint (/api/notify) is deprecated. Please use custom API endpoints configured under /api/custom/[yourEndpointPath].',
    status: 'DEPRECATED',
    timestamp: new Date().toISOString(),
  }, { status: 410 }); // 410 Gone
}
