/**
 * Loads `server/.env` when present so integration tests can use the same
 * credentials as local dev. Skips silently in CI when the file is absent.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';

const envPath = path.join(process.cwd(), '.env');
if (existsSync(envPath)) {
  config({ path: envPath });
}
