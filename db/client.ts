import { Pool, types } from 'pg';

// DATE -> 'YYYY-MM-DD' string (default would be a JS Date shifted by the server timezone).
types.setTypeParser(1082, (value) => value);
// NUMERIC -> number (rating).
types.setTypeParser(1700, (value) => parseFloat(value));

const globalForDb = globalThis as unknown as { kkhPool?: Pool };

// One pool per process; reused across Next.js dev hot reloads.
export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Add it to .env.local (see .env.example).');
  }
  globalForDb.kkhPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  return globalForDb.kkhPool;
}

// For CLI scripts: load .env.local / .env the same way Next.js does.
export function loadEnvForScripts(): void {
  for (const file of ['.env.local', '.env']) {
    try { process.loadEnvFile(file); } catch { /* file missing */ }
  }
}
