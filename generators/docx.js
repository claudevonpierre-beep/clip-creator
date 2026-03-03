/**
 * generators/docx.js — DOCX export using the `docx` npm package
 */
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, TableRow, TableCell, Table,
  WidthType, ShadingType,
} from 'docx';

function safeStr(v) { return String(v || ''); }

export async function generateDocx(analysis, meta = {}) {
  const children = [];

  const h = (text, level = HeadingLevel.HEADING_1) =>
    new Paragraph({ text: safeStr(text), heading: level, spacing: { before: 300, after: 100 } });

  const p = (text, opts = {}) =>
    new Paragraph({
      children: [new TextRun({ text: safeStr(text), ...opts })],
      spacing: { after: 80 },
    });

  const rule = () => new Paragraph({
    border: { bottom: { color: 'C5A44E', style: BorderStyle.SINGLE, size: 6 } },
    spacing: { after: 200 },
  });

  // Title
  children.push(new Paragraph({
    children: [new TextRun({ text: meta.episodeName || 'Episode', bold: true, size: 48, color: '1e3a5f' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
  }));
  if (meta.show) {
    children.push(new Paragraph({
      children: [new TextRun({ text: meta.show, size: 28, color: '8b8fa3' })],
      alignment: AlignmentType.CENTER,
    }));
  }
  if (meta.guest) {
    children.push(new Paragraph({
      children: [new TextRun({ text: `Guest: ${meta.guest}`, size: 24, color: '8b8fa3' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }));
  }
  children.push(rule());

  // Viral Clips
  const clips = analysis.viral_clips || analysis.clips || [];
  if (clips.length) {
    children.push(h('VIRAL CLIPS', HeadingLevel.HEADING_1));
    clips.forEach((c, i) => {
      children.push(h(`#${i + 1} — ${c.title || c.clip_title || 'Untitled'}`, HeadingLevel.HEADING_2));
      const tc = [c.start_time || c.timecode, c.end_time].filter(Boolean).join(' → ');
      if (tc) children.push(p(`Timecode: ${tc}`, { bold: true, color: 'c5a44e' }));
      if (c.score) children.push(p(`Score: ${c.score}`, { bold: true }));
      const desc = c.description || c.why_it_works || '';
      if (desc) children.push(p(desc));
      children.push(new Paragraph({ spacing: { after: 200 } }));
    });
    children.push(rule());
  }

  // Suggested Titles
  const titles = analysis.titles || analysis.episode_titles || [];
  if (titles.length) {
    children.push(h('SUGGESTED TITLES', HeadingLevel.HEADING_1));
    titles.forEach((t, i) => {
      const text = typeof t === 'string' ? t : (t.title || t.text || JSON.stringify(t));
      children.push(p(`${i + 1}. ${text}`));
    });
    children.push(rule());
  }

  // VOD Segments
  const vods = analysis.vod_segments || [];
  if (vods.length) {
    children.push(h('VOD SEGMENTS', HeadingLevel.HEADING_1));
    vods.forEach((v, i) => {
      children.push(h(`#${i + 1} — ${v.title || 'Segment'}`, HeadingLevel.HEADING_2));
      if (v.start_time) children.push(p(`In: ${v.start_time} | Out: ${v.end_time || '?'}`, { bold: true, color: 'c5a44e' }));
      if (v.description) children.push(p(v.description));
      children.push(new Paragraph({ spacing: { after: 120 } }));
    });
    children.push(rule());
  }

  // Thumbnail Quotes
  const thumbs = analysis.thumbnail_quotes || [];
  if (thumbs.length) {
    children.push(h('THUMBNAIL QUOTES', HeadingLevel.HEADING_1));
    thumbs.forEach((t, i) => {
      const quote = typeof t === 'string' ? t : (t.quote || t.text || JSON.stringify(t));
      children.push(p(`${i + 1}. "${quote}"`, { italics: true }));
    });
  }

  const doc = new Document({
    sections: [{ children }],
    styles: {
      default: {
        document: {
          run: { font: 'Helvetica', size: 22 },
        },
      },
    },
  });

  return Packer.toBuffer(doc);
}
