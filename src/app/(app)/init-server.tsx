// Import this code only on the server side
import { headers } from 'next/headers';

// Remove direct server initialization from here since it's now handled in server.ts

export default function InitServer() {
  // This forces the function to be executed on the server
  headers();
  return null;
}
