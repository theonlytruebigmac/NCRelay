#!/usr/bin/env ts-node
import fs from 'fs';
import path from 'path';

// Configuration
const MIGRATIONS_DIR = path.join(__dirname, '..', 'src', 'migrations');
const INDEX_FILE = path.join(MIGRATIONS_DIR, 'index.ts');

/**
 * Find the next available migration number by scanning existing migration files
 */
function findNextMigrationNumber(): number {
  try {
    // Read all files in the migrations directory
    const files = fs.readdirSync(MIGRATIONS_DIR);
    
    // Extract migration numbers from filenames
    const existingNumbers = files
      .filter(filename => /^\d{3}-.*\.ts$/.test(filename))
      .map(filename => {
        const match = filename.match(/^(\d{3})/);
        return match ? parseInt(match[1], 10) : 0;
      });
    
    // Find the highest number
    const highestNumber = Math.max(0, ...existingNumbers);
    
    // Return the next number
    return highestNumber + 1;
  } catch (error) {
    console.error('Error finding next migration number:', error);
    return 1; // Default to 1 if there was an error
  }
}

/**
 * Generate a normalized filename from the migration description
 */
function generateFilename(description: string, number: number): string {
  // Convert the description to kebab-case and clean it up
  const normalizedDescription = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length
  
  // Format as "001-description.ts"
  const paddedNumber = number.toString().padStart(3, '0');
  return `${paddedNumber}-${normalizedDescription}.ts`;
}

/**
 * Generate the migration file content
 */
function generateMigrationContent(description: string): string {
  const normalizedName = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  return `import Database from 'better-sqlite3';

export default {
  name: '${normalizedName}',
  up: (db: Database.Database): void => {
    // Add your migration SQL statements here
    // For example:
    // db.exec(\`
    //   ALTER TABLE table_name
    //   ADD COLUMN new_column TEXT;
    // \`);
  }
};
`;
}

/**
 * Update the index file with the new migration
 */
function updateIndexFile(filename: string, migrationNumber: number, description: string) {
  const indexContent = fs.readFileSync(INDEX_FILE, 'utf-8');
  
  // Create import statement
  const importName = path.basename(filename, '.ts');
  const importVar = `migration${migrationNumber.toString().padStart(3, '0')}`;
  const importLine = `import ${importVar} from './${importName}';`;
  
  // Add import to imports section
  let updatedContent = indexContent.replace(
    /(\/\/ Import all migrations statically[\s\S]*?)(\/\/ Add new migration imports here\.\.\.)/,
    `$1import ${importVar} from './${importName}';\n$2`
  );
  
  // Add migration to the migrations array
  updatedContent = updatedContent.replace(
    /(const migrations: Migration\[] = \[[\s\S]*?)(\/\/ Add new migrations here:)/,
    `$1$2\n    {\n      id: ${migrationNumber},\n      name: ${importVar}.name || '${description.toLowerCase().replace(/[^a-z0-9-]/g, '-')}',\n      up: ${importVar}.up\n    },`
  );
  
  // Write updated content back
  fs.writeFileSync(INDEX_FILE, updatedContent);
}

/**
 * Main function to create a migration file
 */
function createMigration(description: string): void {
  if (!description) {
    console.error('Error: Migration description is required');
    console.log('Usage: npm run create-migration "Add user preferences"');
    process.exit(1);
  }
  
  try {
    // Find the next migration number
    const nextNumber = findNextMigrationNumber();
    
    // Generate filename
    const filename = generateFilename(description, nextNumber);
    const filePath = path.join(MIGRATIONS_DIR, filename);
    
    // Check if file already exists
    if (fs.existsSync(filePath)) {
      console.error(`Error: File already exists: ${filePath}`);
      process.exit(1);
    }
    
    // Generate file content
    const content = generateMigrationContent(description);
    
    // Write the file
    fs.writeFileSync(filePath, content);
    console.log(`✅ Created migration file: ${filename}`);
    
    // Update index.ts to include the new migration
    updateIndexFile(filename, nextNumber, description);
    console.log(`✅ Updated migrations/index.ts to include the new migration`);
    
    console.log(`\nNow edit ${filePath} to implement your migration logic.`);
    
  } catch (error) {
    console.error('Error creating migration file:', error);
    process.exit(1);
  }
}

// Get the migration description from command line arguments
const description = process.argv[2];
createMigration(description);
