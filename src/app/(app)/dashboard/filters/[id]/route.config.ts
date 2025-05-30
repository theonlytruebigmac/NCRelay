// This config ensures the [id] route only matches valid UUIDs
export const dynamic = 'force-dynamic';

// Regex to match UUID format
export const routeSegmentConfig = {
  id: {
    // UUID format validation
    match: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  }
};
