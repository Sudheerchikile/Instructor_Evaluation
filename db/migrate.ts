import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPool, loadEnvForScripts } from './client';

async function main() {
  loadEnvForScripts();
  const pool = getPool();
  const sql = readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf8');
  await pool.query(sql);
  const { rows } = await pool.query<{ current_database: string }>('SELECT current_database()');
  console.log(`Schema applied to database "${rows[0].current_database}".`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
