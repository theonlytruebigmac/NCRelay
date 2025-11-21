// @ts-check
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
// Import the server initialization module
import { initializeApp } from './src/server.js';
// Import environment validation
import { validateEnv } from './src/lib/env.js';

// Validate environment variables on startup
console.log('Validating environment variables...');
try {
  validateEnv();
  console.log('Environment variables validated successfully');
} catch (error) {
  console.error('Environment validation failed:', error.message);
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = parseInt(process.env.PORT || '3000', 10);
const hostname = process.env.HOST || '0.0.0.0';
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  // Initialize the application and scheduled tasks
  console.log('Initializing NCRelay application and scheduled tasks...');
  try {
    // Force initialization regardless of NODE_ENV
    process.env.FORCE_INIT = 'true';
    await initializeApp();
    console.log('NCRelay application and scheduled tasks initialized successfully');
  } catch (error) {
    console.error('Failed to initialize NCRelay application:', error);
  }

  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || '', true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  })
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(
        `> NCRelay Server ready on http://${hostname}:${port}`
      );
    });
});
