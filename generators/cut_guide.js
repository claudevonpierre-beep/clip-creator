/**
 * generators/cut_guide.js — Plain text cut guide
 */

export function generateCutGuide(analysis, meta = {}) {
  const lines = [];
  const hr = '─'.repeat(60);

  lines.push('33RD TEAM CLIP TOOL — CUT GUIDE');
  lines.push(hr);
  if (meta.episodeName) lines.push(`Episode: ${meta.episodeName}`);
  if (meta.show)        lines.push(`Show:    ${meta.show}`);
  if (meta.guest)       lines.push(`Guest:   ${meta.guest}`);
  lines.push(`Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
  lines.push('');

  // Viral Clips
  const clips = analysis.viral_clips || analysis.clips || [];
  if (clips.length) {
    lines.push('VIRAL CLIPS');
    lines.push(hr);
    clips.forEach((c, i) => {
      lines.push(`#${i + 1}  ${c.title || c.clip_title || 'Untitled'}`);
      lines.push(`    Timecode : ${c.start_time || c.timecode || '?'}${c.end_time ? ' → ' + c.end_time : ''}`);
      if (c.score)       lines.push(`    Score    : ${c.score}`);
      if (c.description) lines.push(`    Why      : ${c.description}`);
      if (c.why_it_works) lines.push(`    Why      : ${c.why_it_works}`);
      lines.push('');
    });
  }

  // Titles
  const titles = analysis.titles || analysis.episode_titles || [];
  if (titles.length) {
    lines.push('SUGGESTED TITLES');
    lines.push(hr);
    titles.forEach((t, i) => {
      const text = typeof t === 'string' ? t : (t.title || t.text || JSON.stringify(t));
      lines.push(`${i + 1}. ${text}`);
    });
    lines.push('');
  }

  // VOD Segments
  const vods = analysis.vod_segments || [];
  if (vods.length) {
    lines.push('VOD SEGMENTS');
    lines.push(hr);
    vods.forEach((v, i) => {
      lines.push(`#${i + 1}  ${v.title || 'Segment'}`);
      if (v.start_time) lines.push(`    In  : ${v.start_time}`);
      if (v.end_time)   lines.push(`    Out : ${v.end_time}`);
      if (v.description) lines.push(`    Note: ${v.description}`);
      lines.push('');
    });
  }

  // Ad Breaks
  const ads = analysis.ad_breaks || [];
  if (ads.length) {
    lines.push('AD BREAKS');
    lines.push(hr);
    ads.forEach((a, i) => {
      lines.push(`#${i + 1}  ${a.label || 'Ad Break'}  @ ${a.timecode || a.start_time || '?'}`);
      if (a.reason) lines.push(`    ${a.reason}`);
      lines.push('');
    });
  }

  // Thumbnail Quotes
  const thumbs = analysis.thumbnail_quotes || [];
  if (thumbs.length) {
    lines.push('THUMBNAIL QUOTES');
    lines.push(hr);
    thumbs.forEach((t, i) => {
      const quote = typeof t === 'string' ? t : (t.quote || t.text || JSON.stringify(t));
      lines.push(`${i + 1}. "${quote}"`);
    });
    lines.push('');
  }

  return lines.join('\n');
}
