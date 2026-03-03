/**
 * generators/srt.js — Generate SRT subtitle file from analysis JSON
 */

function parseTimecode(tc) {
  if (!tc) return 0;
  const parts = tc.trim().split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function toSrtTime(seconds) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s},000`;
}

export function generateSrt(analysis) {
  const clips = analysis.viral_clips || analysis.clips || [];
  if (!clips.length) return '1\n00:00:00,000 --> 00:00:05,000\nNo clips found\n';

  const lines = [];
  clips.forEach((clip, i) => {
    const start = parseTimecode(clip.start_time || clip.timecode || '0:00');
    const end   = parseTimecode(clip.end_time || '') || start + 300; // default 5 min
    lines.push(`${i + 1}`);
    lines.push(`${toSrtTime(start)} --> ${toSrtTime(end)}`);
    lines.push(clip.title || clip.clip_title || `Clip ${i + 1}`);
    if (clip.score) lines.push(`Score: ${clip.score}`);
    lines.push('');
  });

  return lines.join('\n');
}
