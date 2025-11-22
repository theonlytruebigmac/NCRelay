#!/usr/bin/env node

/**
 * Post-build script to add .js extensions to local imports in compiled lib files
 * This is needed for ES modules to work properly in Node.js
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distLibPath = join(__dirname, '..', 'dist', 'src', 'lib');

function addJsExtensions(filePath) {
  let content = readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Replace relative imports without .js extension
  content = content.replace(
    /from ['"](\.[^'"]+)(?<!\.js)['"]/g,
    (match, path) => {
      modified = true;
      return `from '${path}.js'`;
    }
  );
  
  // Replace dynamic imports without .js extension
  content = content.replace(
    /import\(['"](\.[^'"]+)(?<!\.js)['"]\)/g,
    (match, path) => {
      modified = true;
      return `import('${path}.js')`;
    }
  );
  
  // Replace @/lib path aliases with relative paths
  content = content.replace(
    /from ['"]@\/lib\/([^'"]+)['"]/g,
    (match, path) => {
      modified = true;
      // Add .js extension if not present
      const pathWithExt = path.endsWith('.js') ? path : `${path}.js`;
      return `from './${pathWithExt}'`;
    }
  );
  
  // Replace @/lib without subpath
  content = content.replace(
    /from ['"]@\/lib['"]/g,
    (match) => {
      modified = true;
      return `from './index.js'`;
    }
  );
  
  if (modified) {
    writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Fixed imports in ${filePath}`);
  }
}

function processDirectory(dirPath) {
  try {
    const items = readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = join(dirPath, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        processDirectory(fullPath);
      } else if (item.endsWith('.js')) {
        addJsExtensions(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error processing directory ${dirPath}:`, error.message);
  }
}

console.log('Adding .js extensions to compiled lib imports...');
processDirectory(distLibPath);
console.log('Done!');
