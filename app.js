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
  blocks: {
    name: "Blocks (Neal Brennan)",
    hosts: ["Neal Brennan"],
    whatWorks: [
      "Neal's sharp, self-aware comedy and cultural commentary",
      "Mental health, therapy, and vulnerability moments",
      "Hot takes on pop culture and media",
      "Comedian guests getting real and unguarded",
    ],
    whatFails: [
      "Long setup without payoff",
      "Generic celebrity interview format",
    ],
    clipDna: "Neal being brutally honest and funny. Vulnerable moments that hit emotionally. Sharp observations on comedy, culture, or mental health. Guest drops something unexpected and real.",
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
let clipData = [];
let vodData = null;
let thumbData = null;

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
  if (!localStorage.getItem('anthropic_api_key')) openSettings();
});

// === Sidebar ===
function selectMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-item').forEach(el => {
    el.classList.toggle('active', el.dataset.mode === mode);
  });
  const titles = { clips: 'Vertical Clips', vod: 'VOD Suggestions', thumbs: 'Thumbnails' };
  document.getElementById('page-title').textContent = titles[mode];
  // Show relevant output if we have data
  hideAllOutputs();
  if (mode === 'clips' && clipData.length) document.getElementById('clips-output').style.display = '';
  else if (mode === 'vod' && vodData) document.getElementById('vod-output').style.display = '';
  else if (mode === 'thumbs' && thumbData) document.getElementById('thumbs-output').style.display = '';
  else document.getElementById('form-section').style.display = '';
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

// === Helpers ===
function hideAllOutputs() {
  ['clips-output', 'vod-output', 'thumbs-output', 'loading-section'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
}

function backToForm() {
  hideAllOutputs();
  document.getElementById('form-section').style.display = '';
}

function getFormData() {
  const showKey = document.getElementById('show-select').value;
  const profile = getShowProfile(showKey);
  return {
    show: showKey,
    showName: profile.name,
    showContext: buildShowContext(profile),
    episode: document.getElementById('episode-input').value,
    transcript: document.getElementById('transcript-input').value,
    context: document.getElementById('context-input').value,
    clipCount: document.getElementById('clip-count').value,
    clipLength: document.getElementById('clip-length').value
  };
}

// === API Call ===
async function callClaude(prompt, maxTokens = 6000, retries = 4) {
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
      const waitSec = Math.pow(2, attempt + 1); // 2s, 4s, 8s, 16s
      document.getElementById('loading-text').textContent =
        `API overloaded — retrying in ${waitSec}s... (attempt ${attempt + 1}/${retries})`;
      await new Promise(r => setTimeout(r, waitSec * 1000));
      continue;
    }

    throw new Error(err.error?.message || `API error: ${response.status}`);
  }
}

// === Generate ===
async function generate() {
  const form = getFormData();
  if (!form.transcript.trim()) { alert('Paste a transcript first.'); return; }

  document.getElementById('form-section').style.display = 'none';
  hideAllOutputs();
  document.getElementById('loading-section').style.display = '';
  document.getElementById('generate-btn').disabled = true;

  try {
    // Run all three analyses
    document.getElementById('loading-text').textContent = 'Finding viral clip moments...';
    await generateClips(form);

    document.getElementById('loading-text').textContent = 'Generating VOD suggestions...';
    await generateVod(form);

    document.getElementById('loading-text').textContent = 'Creating thumbnail concepts...';
    await generateThumbs(form);

    // Show current mode's output
    document.getElementById('loading-section').style.display = 'none';
    selectMode(currentMode);
  } catch (err) {
    alert(`Generation failed: ${err.message}`);
    document.getElementById('loading-section').style.display = 'none';
    document.getElementById('form-section').style.display = '';
  } finally {
    document.getElementById('generate-btn').disabled = false;
  }
}

// === Clips ===
async function generateClips(form) {
  const prompt = `You are an expert social media producer who identifies viral-worthy vertical clip moments from podcast transcripts. You work for The 33rd Team podcast network.

SHOW: ${form.showName}
EPISODE: ${form.episode}
TARGET CLIP LENGTH: ${form.clipLength} seconds
MAX CLIPS: ${form.clipCount}
${form.context ? `CONTEXT: ${form.context}` : ''}

## SHOW PROFILE:
${form.showContext}

TRANSCRIPT:
${form.transcript}

---

Analyze this transcript and identify the ${form.clipCount} best moments for vertical short-form clips (YouTube Shorts, TikTok, Instagram Reels).

Use the SHOW PROFILE above to rank clips based on THIS SHOW'S specific clip DNA — not generic "good content."

For each clip, evaluate:
- HOOK STRENGTH: Does the first 3 seconds grab attention?
- EMOTIONAL PEAK: Is there a laugh, gasp, hot take, or revelation?
- STANDALONE VALUE: Does it make sense without full episode context?
- SHAREABILITY: Would someone send this to a friend?
- CONTROVERSY/DEBATE: Does it invite comments?

Return ONLY valid JSON (no markdown, no code fences) in this exact format:
{
  "clips": [
    {
      "rank": 1,
      "title": "Short punchy title for the clip",
      "startTime": "HH:MM:SS",
      "endTime": "HH:MM:SS",
      "durationSec": 65,
      "hook": "The first line or moment that grabs attention",
      "quote": "The key 2-3 lines that make this clip fire",
      "tags": ["viral", "funny"],
      "platform": "all",
      "caption": "Suggested social media caption with emojis",
      "hashtags": "#tag1 #tag2 #tag3",
      "whyItWorks": "Brief explanation of viral potential"
    }
  ]
}

Tags should be from: viral, funny, insightful, emotional, controversial, hot-take, storytelling, relatable

If no timestamps are in the transcript, estimate them based on average speaking pace (~150 words/min) from the start. Use HH:MM:SS format always.

Rank clips from most viral potential to least.`;

  const raw = await callClaude(prompt);
  try {
    const parsed = JSON.parse(raw);
    clipData = parsed.clips || [];
    renderClips();
  } catch {
    // Try to extract JSON from response
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      clipData = parsed.clips || [];
      renderClips();
    } else {
      throw new Error('Failed to parse clip data');
    }
  }
}

function renderClips() {
  const container = document.getElementById('clips-content');
  container.innerHTML = clipData.map(clip => `
    <div class="clip-card" data-rank="${clip.rank}">
      <div class="clip-card-inner">
        <div class="clip-header">
          <span class="clip-rank">#${clip.rank}</span>
          <span class="clip-time">${clip.startTime} → ${clip.endTime} · ${clip.durationSec}s</span>
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

// === VOD ===
async function generateVod(form) {
  const prompt = `You are a YouTube strategist for The 33rd Team podcast network. Generate VOD (full episode upload) optimization suggestions.

SHOW: ${form.showName}
EPISODE: ${form.episode}
${form.context ? `CONTEXT: ${form.context}` : ''}

## SHOW PROFILE:
${form.showContext}

TRANSCRIPT:
${form.transcript}

---

Generate YouTube VOD optimization. Return ONLY valid JSON (no markdown, no code fences):
{
  "titles": [
    { "option": "A", "text": "Title option 1", "style": "curiosity gap" },
    { "option": "B", "text": "Title option 2", "style": "direct/SEO" },
    { "option": "C", "text": "Title option 3", "style": "provocative" }
  ],
  "descriptions": [
    {
      "option": "A",
      "text": "Full YouTube description with timestamps, links, social handles, subscribe CTA. Use actual content from the transcript for timestamp chapters."
    }
  ],
  "tags": ["tag1", "tag2", "tag3"],
  "chapters": [
    { "time": "0:00", "title": "Chapter title" }
  ]
}

For titles: one curiosity-gap style, one direct/SEO-friendly, one provocative/clickable. All under 70 chars.
For description: include timestamps as chapters based on the actual transcript topics.
For tags: 15-20 relevant YouTube tags for discoverability.`;

  const raw = await callClaude(prompt);
  try {
    vodData = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) vodData = JSON.parse(match[0]);
    else throw new Error('Failed to parse VOD data');
  }
  renderVod();
}

function renderVod() {
  const c = document.getElementById('vod-content');
  let html = '';

  // Titles
  html += `<div class="vod-card"><h3>📌 Title Options</h3>`;
  (vodData.titles || []).forEach(t => {
    html += `<div class="vod-option">
      <div class="vod-option-label">Option ${t.option} — ${t.style}</div>
      <div class="vod-option-text">${esc(t.text)}</div>
    </div>`;
  });
  html += `</div>`;

  // Description
  (vodData.descriptions || []).forEach(d => {
    html += `<div class="vod-card"><h3>📝 Description (Option ${d.option})</h3>
      <div class="vod-description">${esc(d.text)}</div>
    </div>`;
  });

  // Chapters
  if (vodData.chapters && vodData.chapters.length) {
    html += `<div class="vod-card"><h3>📑 Chapters</h3>`;
    vodData.chapters.forEach(ch => {
      html += `<div class="vod-option">
        <span style="font-family:var(--mono);color:var(--info)">${ch.time}</span> — ${esc(ch.title)}
      </div>`;
    });
    html += `</div>`;
  }

  // Tags
  if (vodData.tags && vodData.tags.length) {
    html += `<div class="vod-card"><h3>🏷 Tags</h3><div class="vod-tags">`;
    vodData.tags.forEach(t => { html += `<span class="vod-tag">${esc(t)}</span>`; });
    html += `</div></div>`;
  }

  c.innerHTML = html;
}

// === Thumbnails ===
async function generateThumbs(form) {
  const prompt = `You are a thumbnail designer/strategist for The 33rd Team podcast network on YouTube. Generate thumbnail concepts.

SHOW: ${form.showName}
EPISODE: ${form.episode}
${form.context ? `CONTEXT: ${form.context}` : ''}

## SHOW PROFILE:
${form.showContext}

TRANSCRIPT:
${form.transcript}

---

Generate 3-4 thumbnail concepts. Return ONLY valid JSON (no markdown, no code fences):
{
  "thumbnails": [
    {
      "concept": "A",
      "title": "Concept name",
      "layout": "Detailed description of the thumbnail layout, positioning, and composition",
      "textOverlay": "THE BOLD TEXT ON THE THUMBNAIL",
      "expression": "Description of talent facial expression / emotion to capture",
      "background": "Background treatment (color, gradient, image)",
      "style": "clean/bold/meme/editorial",
      "whyItWorks": "Why this thumbnail would get clicks"
    }
  ]
}

Thumbnail best practices:
- Max 3-5 words of text overlay (LARGE, readable on mobile)
- High contrast, bold colors
- Expressive face close-ups perform best
- Create curiosity or emotion
- Avoid clutter — simple compositions win
- Consider the show's brand and talent`;

  const raw = await callClaude(prompt, 3000);
  try {
    thumbData = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) thumbData = JSON.parse(match[0]);
    else throw new Error('Failed to parse thumbnail data');
  }
  renderThumbs();
}

function renderThumbs() {
  const c = document.getElementById('thumbs-content');
  c.innerHTML = (thumbData.thumbnails || []).map(t => `
    <div class="thumb-card">
      <h3>Concept ${t.concept}: ${esc(t.title)}</h3>
      <div class="thumb-concept">
        <div class="thumb-concept-label">Layout</div>
        <p>${esc(t.layout)}</p>
      </div>
      <div class="thumb-concept">
        <div class="thumb-concept-label">Text Overlay</div>
        <div class="thumb-text-overlay">${esc(t.textOverlay)}</div>
      </div>
      <div class="thumb-concept">
        <div class="thumb-concept-label">Expression</div>
        <p>${esc(t.expression)}</p>
      </div>
      <div class="thumb-concept">
        <div class="thumb-concept-label">Background</div>
        <p>${esc(t.background)}</p>
      </div>
      ${t.whyItWorks ? `<div class="thumb-why">${esc(t.whyItWorks)}</div>` : ''}
    </div>
  `).join('');
}

// === Premiere Marker Export ===
function exportPremiere() {
  if (!clipData.length) return;

  // Premiere Pro marker CSV format
  // Premiere can import markers via a tab-separated file
  let csv = 'Marker Name\tDescription\tIn\tOut\tDuration\tMarker Type\n';

  clipData.forEach(clip => {
    const name = clip.title.replace(/\t/g, ' ');
    const desc = `${clip.hook} | ${clip.caption}`.replace(/\t/g, ' ').replace(/\n/g, ' ');
    const inTC = toTimecode(clip.startTime);
    const outTC = toTimecode(clip.endTime);
    const dur = toTimecode(secToHMS(clip.durationSec));
    csv += `${name}\t${desc}\t${inTC}\t${outTC}\t${dur}\tComment\n`;
  });

  // Also generate EDL format for broader compatibility
  let edl = 'TITLE: Clip Markers\nFCM: NON-DROP FRAME\n\n';
  clipData.forEach((clip, i) => {
    const num = String(i + 1).padStart(3, '0');
    const inTC = toTimecode(clip.startTime);
    const outTC = toTimecode(clip.endTime);
    edl += `${num}  001      V     C        ${inTC}:00 ${outTC}:00 ${inTC}:00 ${outTC}:00\n`;
    edl += `* FROM CLIP NAME: ${clip.title}\n`;
    edl += `* COMMENT: ${clip.hook}\n\n`;
  });

  // Download CSV (primary)
  downloadFile(`clip-markers.csv`, csv, 'text/csv');

  // Also download EDL
  setTimeout(() => {
    downloadFile(`clip-markers.edl`, edl, 'text/plain');
  }, 500);
}

function toTimecode(hms) {
  // Normalize HH:MM:SS to HH:MM:SS (ensure proper format)
  const parts = hms.replace(/;/g, ':').split(':');
  while (parts.length < 3) parts.unshift('00');
  return parts.map(p => p.padStart(2, '0')).join(':');
}

function secToHMS(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
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

// === Copy ===
function copyClips() {
  const text = clipData.map(c =>
    `#${c.rank} — ${c.title}\nTime: ${c.startTime} → ${c.endTime} (${c.durationSec}s)\nHook: ${c.hook}\nQuote: ${c.quote}\nCaption: ${c.caption}\nTags: ${(c.tags||[]).join(', ')}\n${c.hashtags || ''}\n`
  ).join('\n---\n\n');
  navigator.clipboard.writeText(text).then(() => alert('Clips copied!'));
}

function copyVod() {
  let text = 'TITLE OPTIONS\n';
  (vodData.titles || []).forEach(t => { text += `${t.option} (${t.style}): ${t.text}\n`; });
  text += '\nDESCRIPTION\n';
  (vodData.descriptions || []).forEach(d => { text += d.text + '\n'; });
  text += '\nCHAPTERS\n';
  (vodData.chapters || []).forEach(ch => { text += `${ch.time} ${ch.title}\n`; });
  text += '\nTAGS\n' + (vodData.tags || []).join(', ');
  navigator.clipboard.writeText(text).then(() => alert('VOD suggestions copied!'));
}

function copyThumbs() {
  const text = (thumbData.thumbnails || []).map(t =>
    `CONCEPT ${t.concept}: ${t.title}\nLayout: ${t.layout}\nText: ${t.textOverlay}\nExpression: ${t.expression}\nBackground: ${t.background}\nWhy: ${t.whyItWorks}\n`
  ).join('\n---\n\n');
  navigator.clipboard.writeText(text).then(() => alert('Thumbnail concepts copied!'));
}

function printOutput() { window.print(); }

// === Send to Design ===
function openSendToDesign() {
  if (!thumbData || !thumbData.thumbnails?.length) { alert('Generate thumbnails first.'); return; }
  // Set default deadline to 48h from now
  const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000);
  document.getElementById('design-deadline').value = deadline.toISOString().slice(0, 16);
  // Restore saved producer name
  document.getElementById('producer-name').value = localStorage.getItem('producer_name') || '';
  // Preview concepts
  const preview = document.getElementById('design-concepts-preview');
  preview.innerHTML = thumbData.thumbnails.map(t => `
    <div style="background:var(--bg);padding:10px;border-radius:var(--radius);margin-bottom:8px">
      <strong style="color:var(--accent);font-size:12px">Concept ${t.concept}</strong>: ${esc(t.title)}
      <div style="font-size:18px;font-weight:800;color:#f59e0b;margin-top:4px">${esc(t.textOverlay)}</div>
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
  const form = getFormData();

  if (!producerName) { alert('Enter your name.'); return; }
  if (!deadline) { alert('Set a deadline.'); return; }

  localStorage.setItem('producer_name', producerName);

  try {
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        createdBy: producerName,
        show: form.showName,
        episode: form.episode,
        deadline: new Date(deadline).toISOString(),
        concepts: thumbData.thumbnails,
        notes: notes
      })
    });

    if (!res.ok) throw new Error('Failed to create request');

    closeDesignModal();
    showToast('✅ Thumbnail request sent to Design!');
  } catch (err) {
    alert(`Failed to send: ${err.message}`);
  }
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.display = '';
  setTimeout(() => { toast.style.display = 'none'; }, 4000);
}

function esc(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
