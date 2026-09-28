import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPool, loadEnvForScripts } from './client';
import { hashPassword } from './auth';

// Loads login accounts from db/users.local.csv (git-ignored) into the users table.
//   npm run db:users
// The CSV is the complete list of people who can sign in: accounts not in the file are removed.
// Columns: email,password,role,name   (role = admin | instructor; name is only needed for admins —
// instructors get their full name from the instructor directory by email.)

const FILE = join(process.cwd(), 'db', 'users.local.csv');

// Minimal CSV parser: supports quoted fields ("a,b") and doubled quotes ("say ""hi""").
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim()));
}

async function main() {
  loadEnvForScripts();
  let text: string;
  try {
    text = readFileSync(FILE, 'utf8').replace(/^﻿/, '');
  } catch {
    console.error(`Missing ${FILE}. Copy db/users.example.csv to db/users.local.csv and fill it in.`);
    process.exit(1);
  }

  const [header, ...rows] = parseCsv(text);
  const col = (name: string) => header.map((h) => h.trim().toLowerCase()).indexOf(name);
  const [iEmail, iPassword, iRole, iName] = [col('email'), col('password'), col('role'), col('name')];
  if (iEmail < 0 || iPassword < 0) throw new Error('CSV header must include at least: email,password');

  const pool = getPool();
  const { rows: instructors } = await pool.query<{ id: string; email: string; full_name: string }>('SELECT id, email, full_name FROM instructors');
  const instructorByEmail = new Map(instructors.map((i) => [i.email.toLowerCase(), i]));

  const errors: string[] = [];
  const accounts: Array<{ id: string; email: string; password: string; role: 'admin' | 'instructor'; name: string; instructorId: string | null }> = [];
  const seen = new Set<string>();

  rows.forEach((cells, index) => {
    const line = index + 2;
    const email = (cells[iEmail] ?? '').trim().toLowerCase();
    const password = cells[iPassword] ?? '';
    const role = ((iRole >= 0 ? cells[iRole] : '') || 'instructor').trim().toLowerCase();
    const name = (iName >= 0 ? cells[iName] ?? '' : '').trim();

    if (!email.includes('@')) return errors.push(`line ${line}: invalid email "${email}"`);
    if (seen.has(email)) return errors.push(`line ${line}: duplicate email ${email}`);
    if (!password.trim()) return errors.push(`line ${line}: empty password for ${email}`);
    if (role !== 'admin' && role !== 'instructor') return errors.push(`line ${line}: role must be admin or instructor (got "${role}")`);
    seen.add(email);

    if (role === 'instructor') {
      const instructor = instructorByEmail.get(email);
      if (!instructor) return errors.push(`line ${line}: ${email} is not in the instructor directory (lib/data/instructors.json)`);
      accounts.push({ id: instructor.id, email, password, role, name: instructor.full_name, instructorId: instructor.id });
    } else {
      accounts.push({ id: `ADM-${email}`, email, password, role, name: name || 'Admin', instructorId: null });
    }
    if (password.length < 8) console.warn(`  warning: ${email} has a password shorter than 8 characters`);
  });

  if (errors.length) {
    console.error('No changes made. Fix these rows first:\n  ' + errors.join('\n  '));
    process.exit(1);
  }
  if (!accounts.some((a) => a.role === 'admin')) {
    console.error('No changes made: the file has no admin account.');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const removed = await client.query<{ email: string }>('DELETE FROM users WHERE NOT (email = ANY($1::text[])) RETURNING email', [accounts.map((a) => a.email)]);
    for (const a of accounts) {
      await client.query(
        `INSERT INTO users (id, instructor_id, name, email, role, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id, instructor_id = EXCLUDED.instructor_id, name = EXCLUDED.name,
           role = EXCLUDED.role, password_hash = EXCLUDED.password_hash`,
        [a.id, a.instructorId, a.name, a.email, a.role, await hashPassword(a.password)]
      );
    }
    // Password or role may have changed: sign everyone in the file out so the new details apply.
    await client.query('DELETE FROM sessions');
    await client.query('COMMIT');

    const admins = accounts.filter((a) => a.role === 'admin').length;
    console.log(`Accounts saved: ${accounts.length} (${admins} admin, ${accounts.length - admins} instructors).`);
    if (removed.rowCount) console.log(`Removed accounts not in the file: ${removed.rows.map((r) => r.email).join(', ')}`);
    const without = instructors.filter((i) => !seen.has(i.email.toLowerCase()));
    if (without.length) console.log(`Instructors in the directory without a login (${without.length}): ${without.map((i) => i.full_name).join(', ')}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
