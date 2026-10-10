import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getPool } from './client';
import { InstructorUser } from '../lib/types';
import { SESSION_MAX_AGE_SECONDS } from '../lib/sessionCookie';

// Password hashing (scrypt, per-user salt) and DB-backed sessions. Accounts are created only by
// `npm run db:users`; there is no self-registration.

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, keyB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Used when the email is unknown so the response time doesn't reveal which emails have accounts.
const DUMMY_HASH = `scrypt$${Buffer.alloc(16).toString('base64')}$${Buffer.alloc(KEY_LENGTH).toString('base64')}`;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'instructor';
  instructor_id: string | null;
  password_hash: string;
  is_senior?: boolean; // absent before the column was added
}

const toUser = (row: UserRow): InstructorUser => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  instructorId: row.instructor_id,
  isSenior: row.role === 'instructor' && !!row.is_senior,
});

export async function authenticate(email: string, password: string): Promise<InstructorUser | null> {
  const { rows } = await getPool().query<UserRow>('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
  const row = rows[0];
  const valid = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  return row && valid ? toUser(row) : null;
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const pool = getPool();
  await pool.query('DELETE FROM sessions WHERE expires_at < now()');
  await pool.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(secs => $3))`,
    [hashToken(token), userId, SESSION_MAX_AGE_SECONDS]
  );
  return token;
}

export async function getSessionUser(token: string | undefined): Promise<InstructorUser | null> {
  if (!token) return null;
  const { rows } = await getPool().query<UserRow>(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)]
  );
  return rows[0] ? toUser(rows[0]) : null;
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (token) await getPool().query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}
