/**
 * Clip Creator v2 — Express server
 * Serves existing frontend + adds library, auth, exports, transcription, admin
 */
process.on('uncaughtException', (err) => { console.error('UNCAUGHT:', err); process.exit(1); });
process.on('unhandledRejection', (err) => { console.error('UNHANDLED:', err); process.exit(1); });

import express from 'express';
import session from 'express-session';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, mkdirSync } from 'fs';
import { createServer } from 'http';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import db, { DATA_DIR } from './db.js';
import {
  requireAuth, requireAdmin,
  checkPassword, upsertGoogleUser,
  getGoogleAuthUrl, exchangeCodeForUser, getUserById,
  createInvite, GOOGLE_CLIENT_ID, ADMIN_EMAIL,
} from './auth.js';
import { generateSrt } from './generators/srt.js';
import { generateMarkersCSV, generateMarkersXML } from './generators/markers.js';
import { generateCutGuide } from './generators/cut_guide.js';
import { generateDocx } from './generators/docx.js';
import { generatePdf } from './generators/pdf.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3334', 10);

// ── EJS template engine (manual, no dependency) ────────────────────────────────
function renderTemplate(file, vars = {}) {
  let html = readFileSync(path.join(__dirname, 'views', file), 'utf8');
  // Process: <%- %> (unescaped), <%= %> (escaped), <% %> (code)
  const lines = [];
  let code = 'let __out = [];\nwith(__vars) {\n';
  const parts = html.split(/<%(-?)=(.*?)%>|<%([\s\S]*?)%>/g);
  // Use a simple EJS-style renderer via Function
  return renderEJS(html, vars);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderEJS(template, vars) {
  let code = 'let __o = "";\n';
  const parts = template.split(/(<%[-=]?[\s\S]*?%>)/);
  for (const part of parts) {
    if (part.startsWith('<%=')) {
      const expr = part.slice(3, -2).trim();
      code += `__o += escapeHtml(${expr});\n`;
    } else if (part.startsWith('<%-')) {
      const expr = part.slice(3, -2).trim();
      code += `__o += (${expr} ?? '');\n`;
    } else if (part.startsWith('<%')) {
      code += part.slice(2, -2) + '\n';
    } else {
      code += `__o += ${JSON.stringify(part)};\n`;
    }
  }
  code += 'return __o;';
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('escapeHtml', ...Object.keys(vars), code);
    return fn(escapeHtml, ...Object.values(vars));
  } catch (e) {
    return `<pre>Template error: ${e.message}</pre>`;
  }
}

function sendView(res, file, vars = {}) {
  try {
    const html = renderEJS(readFileSync(path.join(__dirname, 'views', file), 'utf8'), vars);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (e) {
    res.status(500).send(`View error: ${e.message}`);
  }
}

// ── Persist SESSION_SECRET ──────────────────────────────────────────────────────
if (!process.env.SESSION_SECRET) {
  const generated = crypto.randomBytes(32).toString('hex');
  const envPath = path.join(__dirname, '.env');
  const envContent = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  if (!envContent.includes('SESSION_SECRET=')) {
    const line = `SESSION_SECRET=${generated}\n`;
    writeFileSync(envPath, envContent + (envContent.endsWith('\n') || !envContent ? '' : '\n') + line);
  }
  process.env.SESSION_SECRET = generated;
}

// ── App setup ──────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days
}));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
mkdirSync(UPLOADS_DIR, { recursive: true });

// ── Serve uploaded files — auth required ───────────────────────────────────────
app.use('/data/uploads', requireAuth, express.static(UPLOADS_DIR));

// ── Static files ───────────────────────────────────────────────────────────────
// Uploaded thumbnails served through auth-gated route (not raw static)
app.use(express.static(__dirname, {
  index: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') && !filePath.includes('node_modules')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  },
}));

// ── Auth rate limiting ─────────────────────────────────────────────────────────
const authFails = {};
function checkRate(ip) {
  const now = Date.now();
  const hits = (authFails[ip] || []).filter(t => now - t < 60000);
  if (hits.length >= 5) return false;
  authFails[ip] = hits;
  return true;
}
function recordFail(ip) {
  authFails[ip] = [...(authFails[ip] || []), Date.now()];
}

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

// ── PAGES ──────────────────────────────────────────────────────────────────────

// Root — serve main app (existing index.html) if authenticated
app.get('/', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login', (req, res) => {
  sendView(res, 'login.html', {
    googleEnabled: !!GOOGLE_CLIENT_ID,
    error: req.query.error || null,
  });
});

app.get('/library', requireAuth, (req, res) => {
  const userId = req.session.userId;
  let episodes;
  if (req.session.authMethod === 'password') {
    episodes = db.prepare('SELECT * FROM episodes ORDER BY created_at DESC').all();
  } else {
    episodes = db.prepare('SELECT * FROM episodes WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  }
  const user = req.session.authMethod === 'password' ? { name: 'Producer' } : getUserById(userId);
  const isAdmin = user?.role === 'admin';
  sendView(res, 'library.html', { episodes, user, isAdmin });
});

app.get('/episode/:id', requireAuth, (req, res) => {
  const episode = db.prepare('SELECT * FROM episodes WHERE id = ?').get(req.params.id);
  if (!episode) return res.status(404).send('Episode not found');
  const thumbnailEdits = db.prepare('SELECT * FROM thumbnail_edits WHERE episode_id = ?').all(episode.id);
  const user = req.session.authMethod === 'password' ? { name: 'Producer' } : getUserById(req.session.userId);
  const host = req.headers.host || `localhost:${PORT}`;
  const shareUrl = episode.share_token ? `http://${host}/share/${episode.share_token}` : null;
  sendView(res, 'episode.html', { episode, thumbnailEdits, user, shareUrl });
});

app.get('/share/:token', (req, res) => {
  const episode = db.prepare('SELECT * FROM episodes WHERE share_token = ?').get(req.params.token);
  if (!episode) return res.status(404).send('Share link not found or revoked');
  let sharedBy = null;
  if (episode.user_id) {
    const owner = db.prepare('SELECT name FROM users WHERE id = ?').get(episode.user_id);
    sharedBy = owner?.name;
  }
  sendView(res, 'share.html', { episode, sharedBy });
});

app.get('/admin', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at ASC').all();
  const invites = db.prepare('SELECT * FROM invites WHERE used_by IS NULL ORDER BY created_at DESC').all();
  const stats = {
    users: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    episodes: db.prepare('SELECT COUNT(*) as c FROM episodes').get().c,
    invites: db.prepare('SELECT COUNT(*) as c FROM invites WHERE used_by IS NULL').get().c,
  };
  const host = req.headers.host || `localhost:${PORT}`;
  const currentUserId = req.session.userId;
  sendView(res, 'admin.html', { users, invites, stats, currentUserId, inviteBase: `http://${host}` });
});

// ── AUTH ───────────────────────────────────────────────────────────────────────

app.post('/auth', (req, res) => {
  const ip = req.ip;
  if (!checkRate(ip)) return res.redirect('/login?error=Too+many+attempts.+Wait+60s.');
  const { password } = req.body;
  if (!checkPassword(password)) {
    recordFail(ip);
    return sendView(res, 'login.html', { googleEnabled: !!GOOGLE_CLIENT_ID, error: 'Incorrect access code.' });
  }
  req.session.userId = 'password-user';
  req.session.authMethod = 'password';
  res.redirect('/');
});

app.get('/auth/google', (req, res) => {
  const url = getGoogleAuthUrl();
  if (!url) return res.status(400).send('Google OAuth not configured');
  res.redirect(url);
});

app.get('/auth/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.redirect('/login?error=OAuth+failed');
    const profile = await exchangeCodeForUser(code);

    // Check invite requirement
    const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const isAdmin = profile.email === ADMIN_EMAIL || userCount === 0;
    if (!isAdmin && GOOGLE_CLIENT_ID) {
      const invite = db.prepare('SELECT * FROM invites WHERE (email = ? OR email IS NULL) AND used_by IS NULL').get(profile.email);
      if (!invite) return res.redirect('/login?error=Invite+required.+Ask+your+admin+for+an+invite+link.');
    }

    const user = upsertGoogleUser(profile);

    // Mark invite as used if found
    const invite = db.prepare('SELECT * FROM invites WHERE (email = ? OR email IS NULL) AND used_by IS NULL').get(profile.email);
    if (invite) {
      db.prepare('UPDATE invites SET used_by = ?, used_at = datetime("now") WHERE id = ?').run(user.id, invite.id);
    }

    req.session.userId = user.id;
    req.session.authMethod = 'google';
    res.redirect('/');
  } catch (e) {
    console.error('OAuth callback error:', e);
    res.redirect('/login?error=' + encodeURIComponent(e.message));
  }
});

app.get('/invite/:code', async (req, res) => {
  const invite = db.prepare('SELECT * FROM invites WHERE code = ? AND used_by IS NULL').get(req.params.code);
  if (!invite) return res.status(404).send('Invite link invalid or already used');
  req.session.pendingInviteCode = req.params.code;
  const url = getGoogleAuthUrl();
  if (!url) return res.redirect('/login');
  res.redirect(url);
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ── API: Me ────────────────────────────────────────────────────────────────────

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json(null);
  if (req.session.authMethod === 'password') return res.json({ name: 'Producer', role: 'admin', authMethod: 'password' });
  const user = getUserById(req.session.userId);
  res.json(user ? { ...user, authMethod: 'google' } : null);
});

app.get('/api/config', (req, res) => {
  res.json({ googleEnabled: !!GOOGLE_CLIENT_ID });
});

// ── API: Episodes ──────────────────────────────────────────────────────────────

app.post('/api/episodes', requireAuth, (req, res) => {
  const { show, episodeName, guest, transcript, analysisJson, wordCount } = req.body;
  const userId = req.session.authMethod === 'password' ? null : req.session.userId;
  const result = db.prepare(
    'INSERT INTO episodes (user_id, show, episode_name, guest, transcript, analysis_json, word_count) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, show || '', episodeName || '', guest || '', transcript || '', analysisJson || '{}', wordCount || 0);
  const episode = db.prepare('SELECT * FROM episodes WHERE id = ?').get(result.lastInsertRowid);
  res.json(episode);
});

app.get('/api/episodes', requireAuth, (req, res) => {
  const userId = req.session.userId;
  let episodes;
  if (req.session.authMethod === 'password') {
    episodes = db.prepare('SELECT * FROM episodes ORDER BY created_at DESC').all();
  } else {
    episodes = db.prepare('SELECT * FROM episodes WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  }
  res.json(episodes);
});

app.get('/api/episodes/:id', requireAuth, (req, res) => {
  const episode = db.prepare('SELECT * FROM episodes WHERE id = ?').get(req.params.id);
  if (!episode) return res.status(404).json({ error: 'Not found' });
  const thumbnailEdits = db.prepare('SELECT * FROM thumbnail_edits WHERE episode_id = ?').all(episode.id);
  res.json({ ...episode, thumbnailEdits });
});

app.delete('/api/episodes/:id', requireAuth, (req, res) => {
  const episode = db.prepare('SELECT * FROM episodes WHERE id = ?').get(req.params.id);
  if (!episode) return res.status(404).json({ error: 'Not found' });
  // Allow if password user (admin) or owner
  if (req.session.authMethod !== 'password' && episode.user_id !== req.session.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  db.prepare('DELETE FROM episodes WHERE id = ?').run(episode.id);
  res.json({ ok: true });
});

// ── API: Share ─────────────────────────────────────────────────────────────────

app.post('/api/episodes/:id/share', requireAuth, (req, res) => {
  const episode = db.prepare('SELECT * FROM episodes WHERE id = ?').get(req.params.id);
  if (!episode) return res.status(404).json({ error: 'Not found' });
  const token = episode.share_token || uuidv4();
  db.prepare('UPDATE episodes SET share_token = ? WHERE id = ?').run(token, episode.id);
  const host = req.headers.host || `localhost:${PORT}`;
  res.json({ token, url: `http://${host}/share/${token}` });
});

app.delete('/api/episodes/:id/share', requireAuth, (req, res) => {
  db.prepare('UPDATE episodes SET share_token = NULL WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── API: Thumbnail edits ───────────────────────────────────────────────────────

app.put('/api/episodes/:id/thumbnail/:clipId', requireAuth, (req, res) => {
  const { quoteText, producerBrief, driveLink } = req.body;
  const episodeId = parseInt(req.params.id, 10);
  const clipId = req.params.clipId;
  const existing = db.prepare('SELECT id FROM thumbnail_edits WHERE episode_id = ? AND clip_id = ?').get(episodeId, clipId);
  if (existing) {
    db.prepare('UPDATE thumbnail_edits SET quote_text=?, producer_brief=?, drive_link=?, updated_at=datetime("now") WHERE id=?')
      .run(quoteText || '', producerBrief || '', driveLink || '', existing.id);
  } else {
    db.prepare('INSERT INTO thumbnail_edits (episode_id, clip_id, quote_text, producer_brief, drive_link) VALUES (?,?,?,?,?)')
      .run(episodeId, clipId, quoteText || '', producerBrief || '', driveLink || '');
  }
  res.json({ ok: true });
});

// ── API: Downloads ─────────────────────────────────────────────────────────────

app.get('/api/episodes/:id/download/:type', requireAuth, async (req, res) => {
  const episode = db.prepare('SELECT * FROM episodes WHERE id = ?').get(req.params.id);
  if (!episode) return res.status(404).json({ error: 'Not found' });

  let analysis = {};
  try { analysis = JSON.parse(episode.analysis_json || '{}'); } catch (e) {}
  const meta = { episodeName: episode.episode_name, show: episode.show, guest: episode.guest };
  const slug = (episode.episode_name || 'episode').replace(/[^a-z0-9]/gi, '-').toLowerCase();

  switch (req.params.type) {
    case 'srt':
      res.setHeader('Content-Disposition', `attachment; filename="${slug}.srt"`);
      res.setHeader('Content-Type', 'text/plain');
      return res.send(generateSrt(analysis));

    case 'markers_csv':
      res.setHeader('Content-Disposition', `attachment; filename="${slug}-markers.csv"`);
      res.setHeader('Content-Type', 'text/csv');
      return res.send(generateMarkersCSV(analysis));

    case 'markers_xml':
      res.setHeader('Content-Disposition', `attachment; filename="${slug}-markers.xml"`);
      res.setHeader('Content-Type', 'application/xml');
      return res.send(generateMarkersXML(analysis));

    case 'cut_guide':
      res.setHeader('Content-Disposition', `attachment; filename="${slug}-cut-guide.txt"`);
      res.setHeader('Content-Type', 'text/plain');
      return res.send(generateCutGuide(analysis, meta));

    case 'docx': {
      const buf = await generateDocx(analysis, meta);
      res.setHeader('Content-Disposition', `attachment; filename="${slug}.docx"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      return res.send(buf);
    }

    case 'pdf': {
      const buf = await generatePdf(analysis, meta);
      res.setHeader('Content-Disposition', `attachment; filename="${slug}.pdf"`);
      res.setHeader('Content-Type', 'application/pdf');
      return res.send(buf);
    }

    default:
      return res.status(400).json({ error: 'Unknown export type' });
  }
});

// ── API: Transcription (AssemblyAI) ───────────────────────────────────────────

app.post('/api/transcribe', requireAuth, upload.single('audio'), async (req, res) => {
  const apiKey = req.headers['x-assemblyai-key'] || req.body?.assemblyai_key || process.env.ASSEMBLYAI_KEY;
  if (!apiKey) return res.status(400).json({ error: 'AssemblyAI API key required' });
  if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });

  try {
    // 1. Upload
    const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: { authorization: apiKey, 'content-type': 'application/octet-stream' },
      body: req.file.buffer,
    });
    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return res.status(502).json({ error: `AssemblyAI upload failed: ${err.slice(0, 200)}` });
    }
    const { upload_url } = await uploadRes.json();

    // 2. Submit job
    const jobRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: { authorization: apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ audio_url: upload_url, speaker_labels: true, punctuate: true, format_text: true }),
    });
    const job = await jobRes.json();

    // 3. Poll
    for (let i = 0; i < 240; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${job.id}`, {
        headers: { authorization: apiKey },
      });
      const data = await pollRes.json();
      if (data.status === 'completed') {
        const transcript = formatTranscript(data);
        return res.json({ transcript });
      }
      if (data.status === 'error') {
        return res.status(502).json({ error: `Transcription failed: ${data.error}` });
      }
    }
    res.status(504).json({ error: 'Transcription timed out after 20 minutes' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function formatTranscript(data) {
  const utterances = data.utterances || [];
  if (utterances.length) {
    return utterances.map(u => {
      const ms = u.start || 0;
      const mins = Math.floor(ms / 60000).toString().padStart(2, '0');
      const secs = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
      return `[${mins}:${secs}] [Speaker ${u.speaker || '?'}] ${u.text?.trim() || ''}`;
    }).join('\n');
  }
  const words = data.words || [];
  if (!words.length) return data.text || '';
  const lines = [];
  let chunk = [], lineStart = null;
  for (const w of words) {
    if (lineStart === null) lineStart = w.start || 0;
    chunk.push(w.text || '');
    if (chunk.length >= 15 || (w.start || 0) - lineStart > 8000) {
      const mins = Math.floor(lineStart / 60000).toString().padStart(2, '0');
      const secs = Math.floor((lineStart % 60000) / 1000).toString().padStart(2, '0');
      lines.push(`[${mins}:${secs}] ${chunk.join(' ')}`);
      chunk = []; lineStart = null;
    }
  }
  if (chunk.length && lineStart !== null) {
    const mins = Math.floor(lineStart / 60000).toString().padStart(2, '0');
    const secs = Math.floor((lineStart % 60000) / 1000).toString().padStart(2, '0');
    lines.push(`[${mins}:${secs}] ${chunk.join(' ')}`);
  }
  return lines.join('\n');
}

// ── ADMIN API ──────────────────────────────────────────────────────────────────

app.put('/admin/users/:id/role', requireAdmin, (req, res) => {
  const { role } = req.body;
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ ok: true });
});

app.post('/admin/invites', requireAdmin, (req, res) => {
  const { email } = req.body;
  const userId = req.session.authMethod === 'password' ? null : req.session.userId;
  const code = createInvite(userId, email || null);
  const host = req.headers.host || `localhost:${PORT}`;
  res.json({ code, url: `http://${host}/invite/${code}` });
});

app.delete('/admin/invites/:code', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM invites WHERE code = ?').run(req.params.code);
  res.json({ ok: true });
});

// ── Legacy design queue API (keep existing) ────────────────────────────────────
import { readFileSync as rf, writeFileSync, existsSync } from 'fs';
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json');
function loadRequests() {
  try { return JSON.parse(rf(REQUESTS_FILE, 'utf8')); } catch { return []; }
}
function saveRequests(data) { writeFileSync(REQUESTS_FILE, JSON.stringify(data, null, 2)); }

app.get('/api/requests', (req, res) => res.json(loadRequests()));
app.get('/api/requests/:id', (req, res) => {
  const found = loadRequests().find(r => r.id === req.params.id);
  found ? res.json(found) : res.status(404).json({ error: 'Not found' });
});
app.post('/api/requests', (req, res) => {
  const reqs = loadRequests();
  const request = {
    id: uuidv4(), createdAt: new Date().toISOString(),
    createdBy: req.body.createdBy || 'Jr. Producer',
    show: req.body.show || '', episode: req.body.episode || '',
    deadline: req.body.deadline || '', status: 'pending',
    concepts: req.body.concepts || [], notes: req.body.notes || '',
    designerNotes: '', driveLink: '', completedAt: null, uploadPath: null,
  };
  reqs.unshift(request);
  saveRequests(reqs);
  res.status(201).json(request);
});
app.put('/api/requests/:id', (req, res) => {
  const reqs = loadRequests();
  const idx = reqs.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  Object.assign(reqs[idx], req.body);
  if (req.body.status === 'completed' && !reqs[idx].completedAt) reqs[idx].completedAt = new Date().toISOString();
  saveRequests(reqs);
  res.json(reqs[idx]);
});
app.delete('/api/requests/:id', (req, res) => {
  saveRequests(loadRequests().filter(r => r.id !== req.params.id));
  res.json({ ok: true });
});
app.post('/api/requests/:id/upload', upload.single('file'), (req, res) => {
  const reqs = loadRequests();
  const idx = reqs.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const ct = req.file.mimetype || 'image/png';
  const ext = ct.includes('jpeg') || ct.includes('jpg') ? '.jpg'
            : ct.includes('webp') ? '.webp'
            : ct.includes('gif')  ? '.gif'
            : '.png';
  const filename = `thumb-${req.params.id.slice(0, 8)}${ext}`;
  writeFileSync(path.join(UPLOADS_DIR, filename), req.file.buffer);
  reqs[idx].uploadPath = `/data/uploads/${filename}`;
  // Don't auto-complete on upload — designer marks complete explicitly
  saveRequests(reqs);
  res.json(reqs[idx]);
});

// ── Catch-all: serve static or 404 ────────────────────────────────────────────
app.get('/design-queue', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'design-queue.html')));
app.use((req, res) => res.status(404).send('Not found'));

app.listen(PORT, () => {
  console.log(`\n🎬 Clip Creator v2 running at http://localhost:${PORT}`);
  console.log(`   Library:  http://localhost:${PORT}/library`);
  console.log(`   Admin:    http://localhost:${PORT}/admin`);
  console.log(`   Password: ${process.env.TOOL_PASSWORD || '33rdclips2026'}\n`);
});
