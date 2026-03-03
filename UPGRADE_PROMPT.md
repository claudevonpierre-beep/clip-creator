# Clip Creator v2 Upgrade

You are upgrading clip-creator from a lightweight vanilla JS + Node.js static server into a full-featured web app — keeping the existing frontend UX intact while adding a proper backend.

## What clip-creator is today
- `server.js`: bare Node.js HTTP server, serves static files + a JSON-based design queue API (port 3334)
- `index.html` + `app.js` + `styles.css`: full frontend SPA — calls Anthropic API directly from the browser (API key stored in localStorage), has show profiles for 9 shows, modes: Vertical Clips, Long Clips, VOD Segments, Blocks, Design Queue
- `design-queue.html`: separate page for thumbnail request workflow

## What you need to add

### 1. Upgrade server.js to Express

Replace the bare Node.js HTTP server with Express. Keep port 3334. Add:
- `express` for routing
- `express-session` for sessions (secret from SESSION_SECRET env var, fallback random)
- `better-sqlite3` for SQLite database
- `multer` for file upload handling
- `google-auth-library` for Google OAuth

### 2. SQLite Database (data/clips.db)

Create a `db.js` module that initializes tables on startup:
- users: id, google_id, email, name, avatar_url, role (default 'user'), created_at
- invites: id, code (unique), email (nullable), created_by (fk users), used_by (fk users), used_at, created_at
- episodes: id, user_id (fk users), show, episode_name, guest, analysis_json (TEXT), word_count, share_token (unique nullable), created_at, updated_at
- thumbnail_edits: id, episode_id (fk episodes CASCADE), clip_id, quote_text, producer_brief, drive_link, updated_at

### 3. Auth System

**Password auth (keep existing):**
- POST /auth with password form field
- Compare against TOOL_PASSWORD env var (default: 33rdclips2026)
- Set req.session.userId = 'password-user' and req.session.authMethod = 'password'

**Google OAuth:**
- GET /auth/google — redirect to Google consent screen
  - Scopes: openid email profile
  - Callback URL: GOOGLE_CALLBACK_URL env var (default: http://localhost:3334/auth/callback)
  - Use google-auth-library OAuth2Client
- GET /auth/callback — handle OAuth callback
  - Exchange code for tokens, fetch user info from https://www.googleapis.com/oauth2/v3/userinfo
  - Upsert user in DB by google_id
  - If new user and GOOGLE_CLIENT_ID is set: require invite unless email matches ADMIN_EMAIL
  - Set req.session.userId to user DB id
- POST /auth/logout — destroy session

**Invite system:**
- GET /invite/:code — look up invite, if valid mark as used, set session, redirect to /

**requireAuth middleware:** if no session, redirect to /login
**requireAdmin middleware:** if no session or user.role != 'admin', 403

### 4. New API Routes

**GET /api/me** — return current user info (or null if password-auth or not logged in)

**POST /api/episodes** (requireAuth)
Body JSON: { show, episodeName, guest, analysisJson, wordCount }
Insert episode, return it with id

**GET /api/episodes** (requireAuth)
Return all episodes for current user, sorted by created_at DESC

**GET /api/episodes/:id** (requireAuth)
Return episode + thumbnail_edits array

**DELETE /api/episodes/:id** (requireAuth, must own)

**POST /api/episodes/:id/share** (requireAuth)
Generate uuid share token, save, return { token, url }

**DELETE /api/episodes/:id/share** (requireAuth)
Clear share_token

**PUT /api/episodes/:id/thumbnail/:clipId** (requireAuth)
Body: { quoteText, producerBrief, driveLink }
Upsert thumbnail_edit

**POST /api/transcribe** (requireAuth)
Multipart upload, field: audio. Header x-assemblyai-key or body field assemblyai_key.
- Upload audio to AssemblyAI: POST https://api.assemblyai.com/v2/upload
- Submit: POST https://api.assemblyai.com/v2/transcript with { audio_url, speaker_labels: true, punctuate: true, format_text: true }
- Poll every 5s (max 240 polls)
- Format: [MM:SS] [Speaker A] text
- Return { transcript }
Use node-fetch for HTTP calls. Use multer memoryStorage to get audio buffer.

**GET /api/episodes/:id/download/:type** (requireAuth)
Types: srt, markers_csv, markers_xml, pdf, docx, cut_guide

Put all export logic in `generators/` directory:

**generators/srt.js** — Generate SRT file from viral_clips in analysisJson:
```
1
00:MM:SS,000 --> 00:MM:SS,000
Clip Title

```

**generators/markers.js** — Premiere markers:
CSV: Name, Start (HH:MM:SS:00), Duration, Color (Red for viral), Comment (score)
XML: XMEML v4 format for Premiere Pro

**generators/cut_guide.js** — Plain text cut guide:
Episode header, each viral clip with timecode + title + score + description

**generators/docx.js** — Use `docx` npm package:
Title page (episode + show), each viral clip as H1 with body text, thumbnail quotes section

**generators/pdf.js** — Use `pdfkit`:
Dark theme: bg #0f1117, text #e4e4e7, accent #c5a44e (gold)
Episode title, viral clips with timecodes+scores, thumbnail quotes

### 5. New HTML Pages (same dark aesthetic as index.html — bg #0a0a0a, gold #c5a44e)

**views/login.html** — Login page:
- Big CLIP CREATOR header
- Password input + Unlock button
- If Google OAuth is configured (check GET /api/config), show Sign in with Google button
- Match existing login screen in index.html

**views/library.html** — Episode library:
- Nav: Clip Creator logo, Library (active), back to main app, user info + logout
- Episode cards in a grid: show badge, episode name, guest, date, View/Delete buttons
- Empty state if no episodes
- Filter by show (tabs or dropdown)

**views/episode.html** — Episode detail:
- Nav with back to library
- Episode header: show, name, guest, date
- Viral clips section: each clip card with timecode, title, score, description
- Per-clip thumbnail edit: editable quote text textarea, producer brief textarea, drive link input, Save button
- VOD segments section
- Ad breaks section
- Titles section
- Thumbnail quotes section
- Download buttons bar: SRT, CSV Markers, XML Markers, PDF, DOCX, Cut Guide
- Share button: shows share URL with copy button

**views/share.html** — Public share (no auth required):
- Read-only episode view
- No download buttons, no edit UI
- Banner: "Shared by [name] via Clip Creator"

**views/admin.html** — Admin panel:
- Users table: name, email, role, joined date, promote/demote button
- Invites section: create invite (optional email target), list active invites with copy link + revoke
- Stats: total users, total episodes

### 6. Frontend Updates (index.html / app.js)

Add to existing app.js:
- On load, fetch /api/me and store user info
- If logged in, show small user bar in top-right: avatar/name, Library link, Logout button
- After successful analysis render, show Save to Library button
- Save to Library: POST /api/episodes with { show, episodeName, guest, analysisJson: JSON.stringify(analysisData), wordCount: transcriptText.split(' ').length }
- Show success toast with link to /library after save

Do NOT break any existing functionality. The Anthropic API call stays in the browser.

### 7. package.json

Create package.json:
```json
{
  "name": "clip-creator",
  "version": "2.0.0",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "express-session": "^1.17.3",
    "better-sqlite3": "^9.4.3",
    "multer": "^1.4.5-lts.1",
    "google-auth-library": "^9.6.3",
    "docx": "^8.5.0",
    "pdfkit": "^0.15.0",
    "node-fetch": "^3.3.2",
    "uuid": "^9.0.0"
  }
}
```

### 8. .env.example

```
PORT=3334
TOOL_PASSWORD=33rdclips2026
SESSION_SECRET=change-me-random-string
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3334/auth/callback
ADMIN_EMAIL=
ASSEMBLYAI_KEY=
DATABASE_URL=data/clips.db
```

## CRITICAL RULES
- Do NOT break index.html, app.js, styles.css — they must still work exactly as before
- The Anthropic API call stays in the browser, never on the server
- Keep design-queue.html and its API routes intact
- Use the same dark theme (#0a0a0a bg, #c5a44e gold) for all new pages
- All new pages live in views/ directory and are served by Express routes
- Run npm install after creating package.json
- Confirm node server.js starts without errors at the end
- Commit when done with message: feat: v2 upgrade - library, OAuth, exports, transcription, admin

When completely finished, run: openclaw system event --text "Done: clip-creator v2 upgrade complete - library, OAuth, exports, transcription, admin" --mode now
