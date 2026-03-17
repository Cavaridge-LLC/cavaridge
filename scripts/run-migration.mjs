import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node scripts/run-migration.mjs <migration-file>');
  process.exit(1);
}

const require = createRequire(resolve(__dirname, '../packages/spaniel/'));
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
const migration = readFileSync(resolve(__dirname, '..', migrationFile), 'utf8');

try {
  await sql.unsafe(migration);
  console.log(`Migration "${migrationFile}" applied successfully`);
} catch (e) {
  console.error('Migration failed:', e.message);
  process.exit(1);
} finally {
  await sql.end();
}
