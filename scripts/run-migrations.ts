import { runMigrations } from '../src/migrations';

// Run migrations standalone
async function main() {
  try {
    await runMigrations();
    process.exit(0);
  } catch (error) {
    console.error('Failed to run migrations:', error);
    process.exit(1);
  }
}

main();
