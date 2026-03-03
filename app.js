// ============================================================
// CLIP CREATOR — app.js
// ============================================================

// === Show Profiles ===
const SHOW_PROFILES = {
  check_the_mic: {
    name: "Check the Mic",
    hosts: ["Sam Monson", "Steve Palazzolo"],
    whatWorks: [
      "Debate and disagreement between hosts (5.8x multiplier)",
      "Sam taking contrarian positions and defending with data",
      "Humor and personality (4.8x multiplier)",
      "Draft content and position rankings",
      "Immediate post-game reactions with strong opinions",
    ],
    whatFails: [
      "Generic player profiles without an attached opinion",
      "Short clips under 7 minutes",
      "Pure information without entertainment",
    ],
    clipDna: "Sam takes a controversial position + defends with data. Hosts disagree. Post-game reactions with strong opinions. Sam dunks on mainstream hot-take culture using actual analysis.",
  },
  in_the_bayou: {
    name: "In The Bayou",
    hosts: ["Tyrann Mathieu", "Tyrell McCall"],
    whatWorks: [
      "Tyrann's personal stories from NFL career and NOLA upbringing (50x multiplier)",
      "New Orleans / Louisiana culture content (14x multiplier)",
      "Humor and personality (10.7x multiplier)",
      "Hot takes and reactions about players Tyrann knows personally (8.3x)",
      "Player gossip tied to Tyrann's insider knowledge",
    ],
    whatFails: [
      "Short informational clips without personality (<7 min = death)",
      "Generic football analysis without personal stories",
      "Guest-focused episodes where Tyrann isn't the star",
    ],
    clipDna: "Tyrann tells personal stories from his NFL career or NOLA upbringing. Tyrann gives hot takes about players he actually played with. NOLA culture debates. Genuinely funny, unscripted moments. Tyrann reacts emotionally to NFL news.",
  },
  home_grown: {
    name: "Home Grown",
    hosts: ["David Carr", "Derek Carr"],
    whatWorks: [
      "Raiders-specific deep dives with insider access",
      "Brother dynamic and disagreements",
      "Coaching and front office insider knowledge",
      "Draft strategy and team-building analysis",
    ],
    whatFails: [
      "Generic NFL content not tied to a specific team angle",
      "Awards predictions and listicles",
      "Non-football content (games, trivia)",
    ],
    clipDna: "David and Derek debating Raiders decisions. Insider access to coaching/front office thinking. Brother dynamic creates natural entertainment. Team-specific deep dives with real knowledge.",
  },
  nfl_spotlight: {
    name: "NFL Spotlight",
    hosts: ["Ari Meirov"],
    whatWorks: [
      "Aggregated lists and rankings",
      "Hot seat discussions for coaches and GMs",
      "Interviews with scouting/front office people",
    ],
    whatFails: [
      "Single player profiles (35-41 views)",
      "Low-energy interviews without stakes",
      "Generic roster updates",
    ],
    clipDna: "Breaking news reactions. Insider scoops and reporting. Ranked lists and aggregated opinions. Interviews where the guest reveals something new.",
  },
  nfl_iq: {
    name: "NFL IQ",
    hosts: ["Logan Ryan", "Cynthia Frelund"],
    whatWorks: [
      "Playoff and postseason content",
      "Logan's personality, trash talk stories, and humor",
      "Debate between Logan's experience and Cynthia's analytics",
      "Game previews with real stakes",
    ],
    whatFails: [
      "Pure analytics episodes without personality",
      "Regular season game previews for small-market teams",
      "Explainer content (how analytics work)",
    ],
    clipDna: "Logan being entertaining and dropping stories. Cynthia's data contradicting Logan's gut feeling. Playoff previews and predictions with stakes. Logan's trash talk and player stories.",
  },
  nof: {
    name: "NOF",
    hosts: ["Nick Underhill"],
    whatWorks: [
      "Saints-specific content (ALL top videos are Saints-focused)",
      "Draft and trade analysis for Saints",
      "Insider reporting with front office sources",
      "Salary cap and roster-building analysis",
    ],
    whatFails: [
      "Generic NFL content not tied to Saints",
      "Awards and league-wide predictions",
      "Non-news episodes during slow periods",
    ],
    clipDna: "Saints draft analysis and trade scenarios. Insider reporting from front office sources. Salary cap breakdowns specific to Saints. Local angle on national NFL stories.",
  },
  st_brown: {
    name: "St. Brown Podcast",
    hosts: ["Amon-Ra St. Brown"],
    whatWorks: [
      "Active player perspective on current NFL events",
      "Behind-the-scenes NFL life content",
      "Reactions to games Amon-Ra played in",
      "Player vs media narrative debates",
    ],
    whatFails: [
      "Generic analysis that any podcast could do",
      "Episodes where Amon-Ra's player perspective isn't featured",
    ],
    clipDna: "Amon-Ra's insider perspective as an active star player. Reactions to his own games and performances. Behind-the-scenes stories from the locker room, practice, and game day. Player perspective on media narratives.",
  },
  other: {
    name: "Other",
    hosts: [],
    whatWorks: ["Engaging stories", "Hot takes and controversy", "Humor and personality", "Insider knowledge"],
    whatFails: ["Generic content without a strong POV", "Pure information without entertainment"],
    clipDna: "Strong opinions, personal stories, emotional moments, humor, and insider knowledge.",
  },
};

function getShowProfile(key) {
  return SHOW_PROFILES[key] || SHOW_PROFILES.other;
}

function buildShowContext(profile) {
  return `HOSTS: ${profile.hosts.length ? profile.hosts.join(', ') : 'Unknown'}
WHAT PERFORMS BEST FOR THIS SHOW:
${profile.whatWorks.map(w => `  - ${w}`).join('\n')}
WHAT UNDERPERFORMS:
${profile.whatFails.map(f => `  - ${f}`).join('\n')}
CLIP DNA (what goes viral for this specific show):
${profile.clipDna}`;
}

// === State ===
let currentMode = 'clips';
let analysisData = null;   // unified result from single Claude call
let transcriptText = '';   // raw transcript (from paste or file)

// === Login ===
function checkLogin() {
  const authed = sessionStorage.getItem('clip_creator_auth');
  if (authed === 'true') {
    document.getElementById('login-screen').style.display = 'none';
  }
  // Otherwise login screen stays visible
}

function attemptLogin() {
  const pw = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');
  if (pw === '33rdclips2026') {
    sessionStorage.setItem('clip_creator_auth', 'true');
    document.getElementById('login-screen').style.display = 'none';
    err.style.display = 'none';
  } else {
    err.style.display = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-password').focus();
  }
}

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
  checkLogin();
  if (!localStorage.getItem('anthropic_api_key')) openSettings();
});

// === Sidebar ===
function selectMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-item').forEach(el => {
    el.classList.toggle('active', el.dataset.mode === mode);
  });

  const titles = {
    clips: 'Vertical Clips',
    long: 'Long Clips',
    vod: 'VOD Segments',
    thumbs: 'Thumbnails',
  };
  if (titles[mode]) {
    document.getElementById('page-title').textContent = titles[mode];
  }

  // If results are showing, scroll to the relevant section
  const resultsVisible = document.getElementById('results-output').style.display !== 'none';
  if (resultsVisible && mode !== 'queue') {
    const sectionMap = { clips: 'sec-clips', long: 'sec-long', vod: 'sec-vod', thumbs: 'sec-thumbs' };
    const secId = sectionMap[mode];
    if (secId) {
      const el = document.getElementById(secId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Open the section if collapsed
        const body = document.getElementById('body-' + mode);
        if (body && body.style.display === 'none') toggleSection(mode);
      }
    }
  } else if (!resultsVisible) {
    document.getElementById('form-section').style.display = '';
  }

  document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// === Settings ===
function openSettings() {
  document.getElementById('api-key-input').value = localStorage.getItem('anthropic_api_key') || '';
  document.getElementById('settings-modal').style.display = '';
}
function closeSettings() { document.getElementById('settings-modal').style.display = 'none'; }
function saveSettings() {
  const key = document.getElementById('api-key-input').value.trim();
  if (key) localStorage.setItem('anthropic_api_key', key);
  else localStorage.removeItem('anthropic_api_key');
  closeSettings();
}

// === Transcript Mode Toggle ===
function setTranscriptMode(mode) {
  const pasteBtn = document.getElementById('toggle-paste');
  const uploadBtn = document.getElementById('toggle-upload');
  const textarea = document.getElementById('transcript-input');
  const dropzone = document.getElementById('transcript-upload');

  if (mode === 'paste') {
    pasteBtn.classList.add('active');
    uploadBtn.classList.remove('active');
    textarea.style.display = '';
    dropzone.style.display = 'none';
  } else {
    pasteBtn.classList.remove('active');
    uploadBtn.classList.add('active');
    textarea.style.display = 'none';
    dropzone.style.display = '';
  }
}

// === File Drop / Upload ===
function handleFileDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  const file = event.dataTransfer.files[0];
  if (file) readTranscriptFile(file);
}

function handleFileSelect(input) {
  const file = input.files[0];
  if (file) readTranscriptFile(file);
}

function readTranscriptFile(file) {
  const allowed = ['.txt', '.csv', '.srt', '.vtt'];
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!allowed.includes(ext)) {
    alert(`Unsupported file type: ${ext}. Use .txt, .csv, .srt, or .vtt`);
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    transcriptText = e.target.result;
    const nameEl = document.getElementById('dropzone-filename');
    nameEl.textContent = `✓ ${file.name} (${Math.round(file.size / 1024)} KB)`;
    nameEl.style.display = '';
    // Also populate the textarea in case user switches back to paste mode
    document.getElementById('transcript-input').value = transcriptText;
  };
  reader.readAsText(file, 'UTF-8');
}

// === Helpers ===
function hideAllSections() {
  ['results-output', 'loading-section'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
}

function backToForm() {
  hideAllSections();
  document.getElementById('form-section').style.display = '';
}

function getFormData() {
  const showKey = document.getElementById('show-select').value;
  const profile = getShowProfile(showKey);
  // Get transcript from textarea (covers both paste and uploaded-then-paste modes)
  const transcript = document.getElementById('transcript-input').value.trim() || transcriptText;
  return {
    show: showKey,
    showName: profile.name,
    showContext: buildShowContext(profile),
    episode: document.getElementById('episode-input').value,
    transcript,
    context: document.getElementById('context-input').value,
    clipCount: document.getElementById('clip-count').value,
    clipLength: document.getElementById('clip-length').value
  };
}

// === Collapsible Sections ===
function toggleSection(id) {
  const body = document.getElementById('body-' + id);
  const chev = document.getElementById('chev-' + id);
  const sec = document.getElementById('sec-' + id);
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : '';
  if (chev) { chev.textContent = isOpen ? '▶' : '▼'; chev.classList.toggle('open', !isOpen); }
  if (sec) sec.classList.toggle('open', !isOpen);
}

// === API Call ===
async function callClaude(prompt, maxTokens = 8000, retries = 4) {
  const apiKey = localStorage.getItem('anthropic_api_key');
  if (!apiKey) { openSettings(); throw new Error('No API key'); }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.content[0].text;
    }

    const err = await response.json().catch(() => ({}));

    // Retry on 529 (overloaded) with exponential backoff
    if (response.status === 529 && attempt < retries) {
      const waitSec = Math.pow(2, attempt + 1);
      document.getElementById('loading-text').textContent =
        `API overloaded — retrying in ${waitSec}s… (attempt ${attempt + 1}/${retries})`;
      await new Promise(r => setTimeout(r, waitSec * 1000));
      continue;
    }

    throw new Error(err.error?.message || `API error: ${response.status}`);
  }
}

// === Build Unified Prompt ===
function buildUnifiedPrompt(form) {
  return `You are an expert podcast producer and YouTube strategist for The 33rd Team podcast network.

Analyze this transcript and produce a COMPLETE episode guide in a single pass.

SHOW: ${form.showName}
EPISODE: ${form.episode}
TARGET VERTICAL CLIP LENGTH: ${form.clipLength} seconds
MAX VERTICAL CLIPS: ${form.clipCount}
${form.context ? `ADDITIONAL CONTEXT: ${form.context}` : ''}

## SHOW PROFILE — USE THIS TO RANK AND PRIORITIZE ALL CONTENT:
${form.showContext}

TRANSCRIPT:
${form.transcript}

---

Analyze the transcript and return a JSON object with this EXACT structure.
Return ONLY valid JSON — no markdown, no code fences, no explanation.

{
  "episode_titles": [
    "Title option 1 (curiosity gap / clickbait but honest)",
    "Title option 2 (direct / SEO-friendly, under 70 chars)",
    "Title option 3 (provocative / bold take)",
    "Title option 4 (guest-name lead if notable guest)",
    "Title option 5 (emotional / story-driven)"
  ],
  "viral_clips": [
    {
      "rank": 1,
      "title": "Short punchy title",
      "hook": "The opening line or moment that grabs attention in the first 3 seconds",
      "quote": "The key 2-3 lines that make this clip fire",
      "tags": ["viral"],
      "startTime": "HH:MM:SS",
      "endTime": "HH:MM:SS",
      "durationSec": 65,
      "caption": "Suggested social media caption with emojis",
      "hashtags": "#tag1 #tag2 #tag3",
      "whyItWorks": "One sentence on viral potential based on show DNA"
    }
  ],
  "long_clips": [
    {
      "rank": 1,
      "title": "Short punchy title for this long clip",
      "quote": "The key line or hook that defines this segment",
      "start": "HH:MM:SS",
      "end": "HH:MM:SS",
      "duration_min": 10,
      "why": "Why this 8+ minute section works as a standalone YouTube upload"
    }
  ],
  "vod_segments": [
    {
      "name": "Segment name",
      "start": "HH:MM:SS",
      "end": "HH:MM:SS",
      "title_a": "YouTube title option A (curiosity gap)",
      "title_b": "YouTube title option B (direct/SEO)",
      "title_c": "YouTube title option C (provocative)",
      "description": "What this segment covers"
    }
  ],
  "thumbnail_quotes": [
    {
      "quote": "Short punchy quote (max 8 words)",
      "timecode": "HH:MM:SS",
      "speaker": "Speaker name",
      "suggested_overlay": "Describe the ideal thumbnail text treatment and visual"
    }
  ],
  "topics": [
    {
      "name": "Topic name",
      "start": "HH:MM:SS",
      "end": "HH:MM:SS",
      "description": "Brief description of this topic segment"
    }
  ],
  "ad_breaks": [
    {
      "timecode": "HH:MM:SS",
      "reason": "Why this is a natural break point"
    }
  ],
  "reference_frames": [
    {
      "timecode": "HH:MM:SS",
      "description": "Describe the visual moment for thumbnail designers — facial expression, body language, energy, context"
    }
  ]
}

RULES:
- Rank viral_clips by actual performance potential using the show's clip DNA above — not generic metrics.
- Include ${form.clipCount} vertical clips, 4-6 long clips (8+ min each), 5-8 VOD segments, 5 episode titles.
- Include 5-8 thumbnail quotes (max 8 words each, visually impactful).
- Include 3-5 ad break suggestions at natural topic transitions.
- Include 5-8 reference frames to help a designer who hasn't seen the episode.
- Include 5-10 topics/segments covering the full episode.
- Long clips must be 8+ minutes each — self-contained stories, debates, or segments.
- Viral clip tags: viral, funny, insightful, emotional, controversial, hot-take, storytelling, relatable.
- Use HH:MM:SS format for all timecodes. If no timestamps in transcript, estimate from avg 150 words/min speaking pace.`;
}

// === Generate (unified single call) ===
async function generate() {
  const form = getFormData();
  if (!form.transcript.trim()) { alert('Paste or upload a transcript first.'); return; }

  document.getElementById('form-section').style.display = 'none';
  hideAllSections();
  document.getElementById('loading-section').style.display = '';
  document.getElementById('generate-btn').disabled = true;
  document.getElementById('loading-text').textContent = 'Analyzing transcript…';

  try {
    const raw = await callClaude(buildUnifiedPrompt(form));
    analysisData = parseJSON(raw);
    if (!analysisData) throw new Error('Failed to parse analysis data from Claude response');

    // Store episode/show for exports
    analysisData._meta = { show: form.showName, episode: form.episode, transcript: form.transcript };

    document.getElementById('loading-section').style.display = 'none';
    renderResults();
    document.getElementById('results-output').style.display = '';
    document.getElementById('form-section').style.display = 'none';

  } catch (err) {
    alert(`Generation failed: ${err.message}`);
    document.getElementById('loading-section').style.display = 'none';
    document.getElementById('form-section').style.display = '';
  } finally {
    document.getElementById('generate-btn').disabled = false;
  }
}

function parseJSON(raw) {
  try { return JSON.parse(raw); } catch { /* try extraction */ }
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch { /* fall through */ } }
  return null;
}

// === Render All Results ===
function renderResults() {
  renderEpisodeTitles();
  renderLongClips();
  renderViralClips();
  renderVodSegments();
  renderThumbnailQuotes();
  renderTopics();
  renderAdBreaks();
  renderReferenceFrames();
}

// === Load episode from library via ?episode=ID ===
(async function loadEpisodeFromUrl() {
  const id = new URLSearchParams(location.search).get('episode');
  if (!id) return;
  try {
    const res = await fetch(`/api/episodes/${id}`);
    if (!res.ok) return;
    const ep = await res.json();
    analysisData = JSON.parse(ep.analysis_json || '{}');
    // Pre-fill episode/show fields if present
    const showEl = document.getElementById('show-select');
    const epEl   = document.getElementById('episode-input');
    if (showEl && ep.show) showEl.value = ep.show;
    if (epEl   && ep.episode_name) epEl.value = ep.episode_name;
    // Show results directly, skip form
    hideAllSections();
    renderResults();
    document.getElementById('results-output').style.display = '';
    // Update page title
    const titleEl = document.getElementById('page-title');
    if (titleEl && ep.episode_name) titleEl.textContent = ep.episode_name;
    // Add a back-to-library button in the toolbar
    const toolbar = document.querySelector('.output-toolbar');
    if (toolbar) {
      const backBtn = document.createElement('a');
      backBtn.href = '/library';
      backBtn.className = 'btn btn-ghost';
      backBtn.textContent = '← Library';
      backBtn.style.textDecoration = 'none';
      toolbar.prepend(backBtn);
    }
  } catch (e) {
    console.error('Failed to load episode from library:', e);
  }
})();

// --- Episode Titles ---
function renderEpisodeTitles() {
  const titles = analysisData.episode_titles || [];
  const el = document.getElementById('body-titles');
  if (!titles.length) { el.innerHTML = '<p class="empty-state">No title suggestions generated.</p>'; return; }
  el.innerHTML = `<div class="titles-list">` +
    titles.map((t, i) => `
      <div class="title-row">
        <span class="title-num">${i + 1}</span>
        <span class="title-text">${esc(t)}</span>
        <button class="btn-copy-small" onclick="copyText(${JSON.stringify(t)})">Copy</button>
      </div>`).join('') +
    `</div>`;
}

// --- Long Clips ---
function renderLongClips() {
  const clips = analysisData.long_clips || [];
  const el = document.getElementById('body-long');
  if (!clips.length) { el.innerHTML = '<p class="empty-state">No long clips found.</p>'; return; }
  el.innerHTML = clips.map(lc => `
    <div class="long-clip-card">
      <div class="long-clip-header">
        <span class="long-clip-rank">#${lc.rank}</span>
        <span class="long-clip-time">${esc(lc.start || '')} → ${esc(lc.end || '')} · ~${lc.duration_min || '?'} min</span>
      </div>
      <div class="long-clip-title">${esc(lc.title)}</div>
      <div class="long-clip-quote">"${esc(lc.quote)}"</div>
      ${lc.why ? `<div class="long-clip-why">${esc(lc.why)}</div>` : ''}
    </div>
  `).join('');
}

// --- Viral Clips ---
function renderViralClips() {
  const clips = analysisData.viral_clips || [];
  const el = document.getElementById('body-clips');
  if (!clips.length) { el.innerHTML = '<p class="empty-state">No vertical clips found.</p>'; return; }
  el.innerHTML = clips.map(clip => `
    <div class="clip-card" data-rank="${clip.rank}">
      <div class="clip-card-inner">
        <div class="clip-header">
          <span class="clip-rank">#${clip.rank}</span>
          <span class="clip-time">${esc(clip.startTime || '')} → ${esc(clip.endTime || '')} · ${clip.durationSec || '?'}s</span>
        </div>
        <div class="clip-title">${esc(clip.title)}</div>
        <div class="clip-hook">${esc(clip.hook)}</div>
        <div class="clip-quote">${esc(clip.quote)}</div>
        <div class="clip-meta">
          ${(clip.tags || []).map(t => `<span class="clip-tag ${t}">${t}</span>`).join('')}
        </div>
        <div class="clip-caption">
          <strong>Caption</strong>
          <p>${esc(clip.caption)}</p>
          <p style="color:var(--teal);margin-top:6px;font-family:var(--mono);font-size:12px">${esc(clip.hashtags || '')}</p>
        </div>
        ${clip.whyItWorks ? `<div class="clip-why">${esc(clip.whyItWorks)}</div>` : ''}
      </div>
    </div>
  `).join('');
}

// --- VOD Segments ---
function renderVodSegments() {
  const segs = analysisData.vod_segments || [];
  const el = document.getElementById('body-vod');
  if (!segs.length) { el.innerHTML = '<p class="empty-state">No VOD segments found.</p>'; return; }
  el.innerHTML = segs.map((seg, i) => `
    <div class="vod-card">
      <h3><span style="color:var(--text-dim);font-size:14px">VOD ${i + 1}</span> ${esc(seg.name)}</h3>
      <div style="color:var(--teal);font-family:var(--mono);font-size:12px;margin-bottom:14px">${esc(seg.start || '')} → ${esc(seg.end || '')}</div>
      <div class="vod-option">
        <div class="vod-option-label">Option A</div>
        <div class="vod-option-text">${esc(seg.title_a || '')}</div>
      </div>
      <div class="vod-option">
        <div class="vod-option-label">Option B</div>
        <div class="vod-option-text">${esc(seg.title_b || '')}</div>
      </div>
      <div class="vod-option">
        <div class="vod-option-label">Option C</div>
        <div class="vod-option-text">${esc(seg.title_c || '')}</div>
      </div>
      ${seg.description ? `<div class="vod-description" style="margin-top:12px">${esc(seg.description)}</div>` : ''}
    </div>
  `).join('');
}

// --- Thumbnail Quotes ---
function renderThumbnailQuotes() {
  const thumbs = analysisData.thumbnail_quotes || [];
  const el = document.getElementById('thumbs-inner');
  if (!thumbs.length) { el.innerHTML = '<p class="empty-state">No thumbnail quotes found.</p>'; return; }
  el.innerHTML = thumbs.map((t, i) => `
    <div class="thumb-card">
      <h3>Quote ${i + 1}</h3>
      <div class="thumb-concept">
        <div class="thumb-concept-label">Quote</div>
        <div class="thumb-text-overlay">"${esc(t.quote)}"</div>
      </div>
      <div class="thumb-concept">
        <div class="thumb-concept-label">Timecode · Speaker</div>
        <p style="font-family:var(--mono);font-size:12px;color:var(--teal)">${esc(t.timecode || '??:??:??')}</p>
        <p>${esc(t.speaker || 'Unknown')}</p>
      </div>
      ${t.suggested_overlay ? `
      <div class="thumb-concept">
        <div class="thumb-concept-label">Suggested Overlay</div>
        <p>${esc(t.suggested_overlay)}</p>
      </div>` : ''}
    </div>
  `).join('');
}

// --- Topics ---
function renderTopics() {
  const topics = analysisData.topics || [];
  const el = document.getElementById('body-topics');
  if (!topics.length) { el.innerHTML = '<p class="empty-state">No topics found.</p>'; return; }
  el.innerHTML = `<div class="simple-list">` +
    topics.map(t => `
      <div class="simple-row">
        <div class="simple-time">${esc(t.start || '??')} → ${esc(t.end || '??')}</div>
        <div>
          <div class="simple-name">${esc(t.name)}</div>
          ${t.description ? `<div class="simple-desc">${esc(t.description)}</div>` : ''}
        </div>
      </div>`).join('') +
    `</div>`;
}

// --- Ad Breaks ---
function renderAdBreaks() {
  const breaks = analysisData.ad_breaks || [];
  const el = document.getElementById('body-ads');
  if (!breaks.length) { el.innerHTML = '<p class="empty-state">No ad break suggestions.</p>'; return; }
  el.innerHTML = `<div class="simple-list">` +
    breaks.map(ab => `
      <div class="simple-row">
        <div class="simple-time">${esc(ab.timecode || '??:??:??')}</div>
        <div class="simple-desc">${esc(ab.reason)}</div>
      </div>`).join('') +
    `</div>`;
}

// --- Reference Frames ---
function renderReferenceFrames() {
  const frames = analysisData.reference_frames || [];
  const el = document.getElementById('body-frames');
  if (!frames.length) { el.innerHTML = '<p class="empty-state">No reference frames found.</p>'; return; }
  el.innerHTML = `<div class="simple-list">` +
    frames.map(rf => `
      <div class="simple-row">
        <div class="simple-time">${esc(rf.timecode || '??:??:??')}</div>
        <div class="simple-desc">${esc(rf.description)}</div>
      </div>`).join('') +
    `</div>`;
}

// ============================================================
// EXPORTS
// ============================================================

// --- Premiere Markers CSV (color-coded, all types) ---
function exportPremiere() {
  if (!analysisData) return;
  const meta = analysisData._meta || {};

  let csv = 'Marker Name\tDescription\tIn\tOut\tDuration\tMarker Type\tColor\n';

  // Viral clips → Red
  (analysisData.viral_clips || []).forEach(clip => {
    const name = `🔥 #${clip.rank} ${clip.title}`.replace(/\t/g, ' ');
    const desc = `${clip.hook || ''} | ${clip.caption || ''}`.replace(/\t|\n/g, ' ');
    const inTC = toTimecode(clip.startTime || '00:00:00');
    const outTC = toTimecode(clip.endTime || '00:00:00');
    const dur = clip.durationSec ? toTimecode(secToHMS(clip.durationSec)) : '';
    csv += `${name}\t${desc}\t${inTC}\t${outTC}\t${dur}\tComment\tRed\n`;
  });

  // Long clips → Green
  (analysisData.long_clips || []).forEach(lc => {
    const name = `🎬 LONG #${lc.rank} ${lc.title}`.replace(/\t/g, ' ');
    const desc = `~${lc.duration_min || '?'} min | ${lc.why || ''}`.replace(/\t|\n/g, ' ');
    const inTC = toTimecode(lc.start || '00:00:00');
    const outTC = toTimecode(lc.end || '00:00:00');
    csv += `${name}\t${desc}\t${inTC}\t${outTC}\t\tComment\tGreen\n`;
  });

  // VOD segments → Cyan
  (analysisData.vod_segments || []).forEach(seg => {
    const name = `📺 VOD: ${seg.name}`.replace(/\t/g, ' ');
    const desc = `${seg.title_a || ''} | ${seg.description || ''}`.replace(/\t|\n/g, ' ');
    const inTC = toTimecode(seg.start || '00:00:00');
    const outTC = toTimecode(seg.end || '00:00:00');
    csv += `${name}\t${desc}\t${inTC}\t${outTC}\t\tComment\tCyan\n`;
  });

  // Topics → Blue
  (analysisData.topics || []).forEach(t => {
    const name = `📘 ${t.name}`.replace(/\t/g, ' ');
    const desc = (t.description || '').replace(/\t|\n/g, ' ');
    const inTC = toTimecode(t.start || '00:00:00');
    const outTC = toTimecode(t.end || '00:00:00');
    csv += `${name}\t${desc}\t${inTC}\t${outTC}\t\tComment\tBlue\n`;
  });

  // Ad breaks → Orange
  (analysisData.ad_breaks || []).forEach(ab => {
    const name = `📢 AD BREAK`;
    const desc = (ab.reason || '').replace(/\t|\n/g, ' ');
    const inTC = toTimecode(ab.timecode || '00:00:00');
    csv += `${name}\t${desc}\t${inTC}\t\t\tComment\tOrange\n`;
  });

  // Thumbnail quotes → Purple
  (analysisData.thumbnail_quotes || []).forEach(tq => {
    const name = `🖼 "${tq.quote}"`.replace(/\t/g, ' ');
    const desc = `Speaker: ${tq.speaker || ''} | ${tq.suggested_overlay || ''}`.replace(/\t|\n/g, ' ');
    const inTC = toTimecode(tq.timecode || '00:00:00');
    csv += `${name}\t${desc}\t${inTC}\t\t\tComment\tPurple\n`;
  });

  const ep = (meta.episode || 'episode').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  downloadFile(`${ep}-markers.csv`, csv, 'text/csv');
  showToast('✅ Markers CSV downloaded!');
}

// --- Cut Guide (.txt) ---
function downloadCutGuide() {
  if (!analysisData) return;
  const meta = analysisData._meta || {};
  const show = (meta.show || 'Show').toUpperCase();
  const ep = (meta.episode || 'Episode').toUpperCase();
  const lines = [];

  lines.push(`${show} — ${ep}`);
  lines.push('='.repeat(60));
  lines.push('');

  // Episode Titles
  lines.push('='.repeat(60));
  lines.push('EPISODE TITLE OPTIONS');
  lines.push('='.repeat(60));
  (analysisData.episode_titles || []).forEach((t, i) => lines.push(`  ${i + 1}. ${t}`));
  lines.push('');

  // Long Clips
  lines.push('='.repeat(60));
  lines.push('LONG CLIPS — 8+ MIN (ranked by standalone value)');
  lines.push('='.repeat(60));
  (analysisData.long_clips || []).forEach(lc => {
    lines.push(`\n${lc.rank}. 🎬 ${(lc.title || '').toUpperCase()} [${lc.start || '??'} - ${lc.end || '??'}] (~${lc.duration_min || '?'} min)`);
    lines.push(`   "${lc.quote || ''}"`);
    lines.push(`   Why: ${lc.why || ''}`);
  });
  lines.push('');

  // VOD Segments
  lines.push('='.repeat(60));
  lines.push('VOD SEGMENTS (with timecodes + 3 title options each)');
  lines.push('='.repeat(60));
  (analysisData.vod_segments || []).forEach((seg, i) => {
    lines.push(`\nVOD ${i + 1}: ${(seg.name || 'Segment').toUpperCase()} [${seg.start || '??'} - ${seg.end || '??'}]`);
    lines.push(`  Title A: ${seg.title_a || ''}`);
    lines.push(`  Title B: ${seg.title_b || ''}`);
    lines.push(`  Title C: ${seg.title_c || ''}`);
    if (seg.description) lines.push(`  Description: ${seg.description}`);
  });
  lines.push('');

  // Viral Clips
  lines.push('='.repeat(60));
  lines.push('VIRAL SOCIAL CLIPS (ranked by potential)');
  lines.push('='.repeat(60));
  (analysisData.viral_clips || []).forEach(clip => {
    const tags = (clip.tags || []).join(', ');
    lines.push(`\n${clip.rank}. ${(clip.title || '').toUpperCase()} [${clip.startTime || '??'} - ${clip.endTime || '??'}] (${clip.durationSec || '?'}s)`);
    lines.push(`   Hook: ${clip.hook || ''}`);
    lines.push(`   "${clip.quote || ''}"`);
    lines.push(`   Caption: ${clip.caption || ''}`);
    lines.push(`   Tags: ${tags}`);
    lines.push(`   Why: ${clip.whyItWorks || ''}`);
    if (clip.hashtags) lines.push(`   ${clip.hashtags}`);
  });
  lines.push('');

  // Topics
  lines.push('='.repeat(60));
  lines.push('TOPICS / SEGMENTS');
  lines.push('='.repeat(60));
  (analysisData.topics || []).forEach(t => {
    lines.push(`\n  [${t.start || '??'} - ${t.end || '??'}] ${t.name}`);
    if (t.description) lines.push(`    ${t.description}`);
  });
  lines.push('');

  // Ad Breaks
  lines.push('='.repeat(60));
  lines.push('AD BREAK SUGGESTIONS');
  lines.push('='.repeat(60));
  (analysisData.ad_breaks || []).forEach(ab => {
    lines.push(`  [${ab.timecode || '??'}] ${ab.reason || ''}`);
  });
  lines.push('');

  // Thumbnail Quotes
  lines.push('='.repeat(60));
  lines.push('THUMBNAIL QUOTES');
  lines.push('='.repeat(60));
  (analysisData.thumbnail_quotes || []).forEach(tq => {
    lines.push(`\n  [${tq.timecode || '??'}] "${tq.quote || ''}"`);
    lines.push(`    Speaker: ${tq.speaker || '?'}`);
    if (tq.suggested_overlay) lines.push(`    Overlay: ${tq.suggested_overlay}`);
  });
  lines.push('');

  // Reference Frames
  lines.push('='.repeat(60));
  lines.push('REFERENCE FRAMES (for thumbnail designers)');
  lines.push('='.repeat(60));
  (analysisData.reference_frames || []).forEach(rf => {
    lines.push(`  [${rf.timecode || '??'}] ${rf.description || ''}`);
  });
  lines.push('');

  const epSlug = (meta.episode || 'episode').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  downloadFile(`${epSlug}-cut-guide.txt`, lines.join('\n'), 'text/plain');
  showToast('✅ Cut Guide downloaded!');
}

// --- SRT Captions ---
function downloadSRT() {
  if (!analysisData) return;
  const meta = analysisData._meta || {};
  const transcript = meta.transcript || '';

  // Try to extract SRT-style entries from the transcript if it has timestamps
  const lines = transcript.split('\n');
  const srtEntries = [];
  let idx = 1;

  // Look for lines with timestamps like [00:05:32] or (5:32) at start
  const tsRegex = /^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(.*)/;
  let prev = null;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(tsRegex);
    if (m) {
      if (prev) {
        // Close previous entry
        srtEntries.push({ idx: idx++, start: prev.time, end: m[1], text: prev.text });
      }
      prev = { time: m[1], text: m[2].trim() };
    } else if (prev && lines[i].trim()) {
      prev.text += ' ' + lines[i].trim();
    }
  }
  if (prev) {
    // Last entry — add 5 seconds
    const endTime = addSeconds(prev.time, 5);
    srtEntries.push({ idx: idx++, start: prev.time, end: endTime, text: prev.text });
  }

  // If no timestamps found in transcript, fall back to viral clips quotes as SRT
  let srt = '';
  if (srtEntries.length > 0) {
    srt = srtEntries.map(e => `${e.idx}\n${toSRTTimecode(e.start)} --> ${toSRTTimecode(e.end)}\n${e.text}\n`).join('\n');
  } else {
    // Fallback: use viral clip timecodes + hooks as SRT
    const clips = analysisData.viral_clips || [];
    if (!clips.length) {
      alert('No timestamp data available to generate SRT.');
      return;
    }
    srt = clips.map((clip, i) => {
      const startSRT = toSRTTimecode(clip.startTime || '00:00:00');
      const endSRT = toSRTTimecode(clip.endTime || '00:00:05');
      const text = clip.title || clip.hook || '';
      return `${i + 1}\n${startSRT} --> ${endSRT}\n${text}\n`;
    }).join('\n');
  }

  const epSlug = (meta.episode || 'episode').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  downloadFile(`${epSlug}-captions.srt`, srt, 'text/plain');
  showToast('✅ SRT Captions downloaded!');
}

function toSRTTimecode(hms) {
  if (!hms) return '00:00:00,000';
  const parts = hms.replace(/[;,]/g, ':').split(':');
  while (parts.length < 3) parts.unshift('00');
  const [h, m, s] = parts;
  return `${h.padStart(2,'0')}:${m.padStart(2,'0')}:${s.padStart(2,'0')},000`;
}

function addSeconds(hms, sec) {
  const parts = hms.split(':').map(Number);
  let total = 0;
  if (parts.length === 3) total = parts[0]*3600 + parts[1]*60 + parts[2];
  else if (parts.length === 2) total = parts[0]*60 + parts[1];
  total += sec;
  return secToHMS(total);
}

// ============================================================
// UTILITY
// ============================================================

function toTimecode(hms) {
  if (!hms) return '00:00:00';
  const parts = hms.replace(/[;,]/g, ':').split(':');
  while (parts.length < 3) parts.unshift('00');
  return parts.map(p => String(p).padStart(2, '0')).join(':');
}

function secToHMS(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Copied!'));
}

function copyThumbs() {
  const thumbs = analysisData?.thumbnail_quotes || [];
  const text = thumbs.map((t, i) =>
    `Quote ${i + 1}: "${t.quote}"\nTimecode: ${t.timecode}\nSpeaker: ${t.speaker}\nOverlay: ${t.suggested_overlay}\n`
  ).join('\n---\n\n');
  navigator.clipboard.writeText(text).then(() => showToast('Thumbnail quotes copied!'));
}

function printOutput() { window.print(); }

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.display = '';
  setTimeout(() => { toast.style.display = 'none'; }, 4000);
}

function esc(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ============================================================
// SEND TO DESIGN
// ============================================================

function openSendToDesign() {
  const thumbs = analysisData?.thumbnail_quotes || [];
  if (!thumbs.length) { alert('Generate results with thumbnail quotes first.'); return; }

  const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000);
  document.getElementById('design-deadline').value = deadline.toISOString().slice(0, 16);
  document.getElementById('producer-name').value = localStorage.getItem('producer_name') || '';

  const preview = document.getElementById('design-concepts-preview');
  preview.innerHTML = thumbs.map((t, i) => `
    <div style="background:var(--bg);padding:12px;border-radius:var(--radius);margin-bottom:10px">
      <div style="font-size:11px;color:var(--accent);font-weight:600;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px">
        Quote ${i + 1} &nbsp;<span style="color:var(--text-dim);font-weight:400">${esc(t.timecode || '')}${t.speaker ? ' · ' + esc(t.speaker) : ''}</span>
      </div>
      <textarea data-quote-idx="${i}" style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);padding:8px 10px;font-size:14px;font-family:var(--font);resize:vertical;outline:none" rows="2">${esc(t.quote)}</textarea>
      ${t.suggested_overlay ? `<div style="font-size:12px;color:var(--text-dim);margin-top:4px">Suggested overlay: ${esc(t.suggested_overlay)}</div>` : ''}
    </div>
  `).join('');

  document.getElementById('design-modal').style.display = '';
}

function closeDesignModal() {
  document.getElementById('design-modal').style.display = 'none';
}

async function sendToDesign() {
  const producerName = document.getElementById('producer-name').value.trim();
  const deadline = document.getElementById('design-deadline').value;
  const notes = document.getElementById('design-notes').value.trim();
  const meta = analysisData?._meta || {};

  if (!producerName) { alert('Enter your name.'); return; }
  if (!deadline) { alert('Set a deadline.'); return; }

  // Send to Design only works when running locally (not on GitHub Pages)
  if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    alert('Send to Design requires the local server. Run the app locally to use this feature.');
    return;
  }

  localStorage.setItem('producer_name', producerName);

  // Collect edited quotes from the modal textareas
  const editedConcepts = (analysisData.thumbnail_quotes || []).map((t, i) => {
    const ta = document.querySelector(`[data-quote-idx="${i}"]`);
    return { ...t, quote: ta ? ta.value.trim() : t.quote };
  });

  try {
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        createdBy: producerName,
        show: meta.show || '',
        episode: meta.episode || '',
        deadline: new Date(deadline).toISOString(),
        concepts: editedConcepts,
        notes
      })
    });
    if (!res.ok) throw new Error('Failed to create request');
    closeDesignModal();
    showToast('✅ Thumbnail request sent to Design!');
  } catch (err) {
    alert(`Failed to send: ${err.message}`);
  }
}

// ── Library: Save to Library ────────────────────────────────────────────────

async function saveToLibrary() {
  if (!analysisData) return alert('No analysis to save.');
  const show = document.getElementById('show-select')?.value || '';
  const episodeName = document.getElementById('episode-input')?.value || '';
  const guest = '';
  const wordCount = transcriptText ? transcriptText.split(/\s+/).length : 0;

  const btn = document.getElementById('save-library-btn');
  if (btn) { btn.textContent = '⏳ Saving…'; btn.disabled = true; }

  try {
    const res = await fetch('/api/episodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        show,
        episodeName,
        guest,
        analysisJson: JSON.stringify(analysisData),
        wordCount,
      }),
    });
    if (!res.ok) throw new Error('Save failed');
    const ep = await res.json();
    const toast = document.getElementById('save-toast');
    if (toast) {
      toast.innerHTML = `✅ Saved! <a href="/episode/${ep.id}" style="color:#c5a44e;font-weight:600">View in Library →</a>`;
      toast.style.display = 'block';
      setTimeout(() => { toast.style.display = 'none'; }, 8000);
    }
    if (btn) { btn.textContent = '✓ Saved'; }
  } catch (e) {
    if (btn) { btn.textContent = '💾 Save to Library'; btn.disabled = false; }
    alert('Failed to save: ' + e.message);
  }
}

// ── Load user info on startup ───────────────────────────────────────────────
(async function loadUser() {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) return;
    const user = await res.json();
    if (!user) return;
    const el = document.getElementById('user-name');
    if (el) el.textContent = user.name || '';
  } catch (e) {}
})();
