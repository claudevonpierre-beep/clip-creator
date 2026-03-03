/**
 * auth.js — Password auth + Google OAuth helpers
 */
import { OAuth2Client } from 'google-auth-library';
import { v4 as uuidv4 } from 'uuid';
import db from './db.js';

const TOOL_PASSWORD     = process.env.TOOL_PASSWORD     || '33rdclips2026';
const GOOGLE_CLIENT_ID  = process.env.GOOGLE_CLIENT_ID  || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL  = process.env.GOOGLE_CALLBACK_URL  || 'http://localhost:3334/auth/callback';
export const ADMIN_EMAIL   = process.env.ADMIN_EMAIL || '';

let oauth2Client = null;
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL);
}

export { GOOGLE_CLIENT_ID, oauth2Client, TOOL_PASSWORD };

// ── Middleware ────────────────────────────────────────────────────────────────

export function requireAuth(req, res, next) {
  if (req.session?.userId) return next();
  if (req.headers['content-type']?.includes('application/json')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.redirect('/login');
}

export function requireAdmin(req, res, next) {
  if (!req.session?.userId) return res.redirect('/login');
  if (req.session.authMethod === 'password') {
    return res.status(403).send('Admin panel requires Google login');
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).send('Admin only');
  next();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function checkPassword(password) {
  // Constant-time comparison
  if (password.length !== TOOL_PASSWORD.length) return false;
  let diff = 0;
  for (let i = 0; i < password.length; i++) {
    diff |= password.charCodeAt(i) ^ TOOL_PASSWORD.charCodeAt(i);
  }
  return diff === 0;
}

export function upsertGoogleUser(profile) {
  // profile: { sub, email, name, picture }
  const existing = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.sub);
  if (existing) {
    db.prepare('UPDATE users SET name = ?, avatar_url = ? WHERE id = ?')
      .run(profile.name, profile.picture, existing.id);
    return { ...existing, name: profile.name, avatar_url: profile.picture };
  }
  // Check if first user (auto-admin)
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get();
  const role = (count.c === 0 || profile.email === ADMIN_EMAIL) ? 'admin' : 'user';
  const result = db.prepare(
    'INSERT INTO users (google_id, email, name, avatar_url, role) VALUES (?, ?, ?, ?, ?)'
  ).run(profile.sub, profile.email, profile.name, profile.picture, role);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
}

export function getGoogleAuthUrl() {
  if (!oauth2Client) return null;
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
  });
}

export async function exchangeCodeForUser(code) {
  if (!oauth2Client) throw new Error('Google OAuth not configured');
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch user info from Google');
  return res.json(); // { sub, email, name, picture, ... }
}

export function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function createInvite(createdBy, email = null) {
  const code = uuidv4();
  db.prepare('INSERT INTO invites (code, email, created_by) VALUES (?, ?, ?)').run(code, email, createdBy);
  return code;
}
