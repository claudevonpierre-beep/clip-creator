/**
 * generators/pdf.js — PDF export using pdfkit
 */
import PDFDocument from 'pdfkit';

const NAVY    = '#1e3a5f';
const GOLD    = '#c5a44e';
const DARK_BG = '#0f1117';
const TEXT    = '#e4e4e7';
const GREY    = '#8b8fa3';
const RED     = '#ef4444';
const CYAN    = '#06b6d4';

function safeStr(v) { return String(v || ''); }

export function generatePdf(analysis, meta = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 100; // usable width

    // ── Page background ──────────────────────────────────────────────────────
    function fillBg() {
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(DARK_BG);
    }
    fillBg();
    doc.on('pageAdded', fillBg);

    // ── Helpers ──────────────────────────────────────────────────────────────
    function rule(color = GOLD, y) {
      const ly = y ?? doc.y;
      doc.moveTo(50, ly).lineTo(50 + W, ly).strokeColor(color).lineWidth(1).stroke();
      doc.y = ly + 10;
    }

    function heading(text, color = GOLD, size = 18) {
      doc.fontSize(size).fillColor(color).font('Helvetica-Bold').text(safeStr(text), 50, doc.y, { width: W });
      doc.moveDown(0.3);
    }

    function body(text, color = TEXT, size = 10) {
      doc.fontSize(size).fillColor(color).font('Helvetica').text(safeStr(text), 50, doc.y, { width: W });
      doc.moveDown(0.2);
    }

    function label(text, value, labelColor = GOLD) {
      doc.fontSize(10).fillColor(labelColor).font('Helvetica-Bold').text(safeStr(text) + '  ', 50, doc.y, { continued: true });
      doc.fillColor(TEXT).font('Helvetica').text(safeStr(value), { width: W });
      doc.moveDown(0.2);
    }

    // ── Cover ────────────────────────────────────────────────────────────────
    doc.moveDown(2);
    heading('33RD TEAM CLIP TOOL', GOLD, 24);
    rule();
    doc.moveDown(0.5);
    heading(meta.episodeName || 'Episode Analysis', TEXT, 20);
    if (meta.show) body(meta.show, GREY, 12);
    if (meta.guest) body(`Guest: ${meta.guest}`, GREY, 11);
    body(new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), GREY, 10);
    doc.moveDown(1);
    rule();

    // ── Viral Clips ──────────────────────────────────────────────────────────
    const clips = analysis.viral_clips || analysis.clips || [];
    if (clips.length) {
      doc.moveDown(0.5);
      heading('VIRAL CLIPS', GOLD, 14);
      clips.forEach((c, i) => {
        if (doc.y > doc.page.height - 150) doc.addPage();
        const title = c.title || c.clip_title || `Clip ${i + 1}`;
        heading(`#${i + 1} — ${title}`, TEXT, 12);
        const tc = [c.start_time || c.timecode, c.end_time].filter(Boolean).join(' → ');
        if (tc) label('Timecode:', tc);
        if (c.score) label('Score:', String(c.score), RED);
        const desc = c.description || c.why_it_works || '';
        if (desc) body(desc, GREY, 9);
        doc.moveDown(0.5);
      });
      rule();
    }

    // ── Titles ───────────────────────────────────────────────────────────────
    const titles = analysis.titles || analysis.episode_titles || [];
    if (titles.length) {
      doc.moveDown(0.5);
      heading('SUGGESTED TITLES', GOLD, 14);
      titles.forEach((t, i) => {
        const text = typeof t === 'string' ? t : (t.title || t.text || JSON.stringify(t));
        body(`${i + 1}. ${text}`);
      });
      rule();
    }

    // ── VOD Segments ─────────────────────────────────────────────────────────
    const vods = analysis.vod_segments || [];
    if (vods.length) {
      doc.moveDown(0.5);
      heading('VOD SEGMENTS', GOLD, 14);
      vods.forEach((v, i) => {
        if (doc.y > doc.page.height - 120) doc.addPage();
        heading(`#${i + 1} — ${v.title || 'Segment'}`, TEXT, 11);
        if (v.start_time) label('In/Out:', `${v.start_time} → ${v.end_time || '?'}`);
        if (v.description) body(v.description, GREY, 9);
        doc.moveDown(0.3);
      });
      rule();
    }

    // ── Thumbnail Quotes ─────────────────────────────────────────────────────
    const thumbs = analysis.thumbnail_quotes || [];
    if (thumbs.length) {
      doc.moveDown(0.5);
      heading('THUMBNAIL QUOTES', GOLD, 14);
      thumbs.forEach((t, i) => {
        const quote = typeof t === 'string' ? t : (t.quote || t.text || JSON.stringify(t));
        body(`${i + 1}. "${quote}"`, CYAN, 10);
      });
    }

    doc.end();
  });
}
