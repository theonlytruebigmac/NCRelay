#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the compiled migrations index file
const indexPath = join(__dirname, '..', 'dist', 'migrations', 'index.js');

try {
  // Read the compiled file
  let content = readFileSync(indexPath, 'utf8');
  
  // Replace relative imports without extensions with .js extensions
  content = content.replace(/from '\.\/([\w-]+)';/g, "from './$1.js';");
  
  // Write the updated content back
  writeFileSync(indexPath, content, 'utf8');
  
  console.log('Successfully fixed migration import extensions');
} catch (error) {
  console.error('Error fixing migration imports:', error);
  process.exit(1);
}
