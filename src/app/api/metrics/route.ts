import { NextResponse } from 'next/server';
import { register } from '@/lib/metrics';

export async function GET() {
  try {
    const metrics = await register.metrics();
    return new Response(metrics, {
      headers: {
        'Content-Type': register.contentType
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate metrics' },
      { status: 500 }
    );
  }
}
