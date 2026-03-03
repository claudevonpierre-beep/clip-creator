/**
 * generators/markers.js — Premiere Pro markers (CSV + XMEML XML)
 */

function parseTimecode(tc) {
  if (!tc) return 0;
  const parts = tc.trim().split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function toPremiereTC(seconds) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}:00`;
}

function buildMarkers(analysis) {
  const markers = [];

  // Viral clips → Red
  for (const c of (analysis.viral_clips || [])) {
    markers.push({
      name: c.title || c.clip_title || 'Clip',
      start: parseTimecode(c.start_time || c.timecode || '0:00'),
      end:   parseTimecode(c.end_time || '') || parseTimecode(c.start_time || '0:00') + 300,
      color: 'Red',
      comment: `Score: ${c.score || ''} | ${c.why_it_works || c.description || ''}`.slice(0, 120),
    });
  }

  // Ad breaks → Orange
  for (const a of (analysis.ad_breaks || [])) {
    markers.push({
      name: a.label || 'Ad Break',
      start: parseTimecode(a.timecode || a.start_time || '0:00'),
      end:   parseTimecode(a.timecode || '0:00') + 60,
      color: 'Orange',
      comment: a.reason || '',
    });
  }

  // Topics → Blue
  for (const t of (analysis.topics || [])) {
    markers.push({
      name: t.title || t.topic || 'Topic',
      start: parseTimecode(t.timecode || t.start_time || '0:00'),
      end:   parseTimecode(t.timecode || '0:00') + 120,
      color: 'Blue',
      comment: '',
    });
  }

  // VOD segments → Cyan
  for (const v of (analysis.vod_segments || [])) {
    markers.push({
      name: v.title || 'VOD Segment',
      start: parseTimecode(v.start_time || '0:00'),
      end:   parseTimecode(v.end_time || '') || parseTimecode(v.start_time || '0:00') + 600,
      color: 'Cyan',
      comment: '',
    });
  }

  return markers.sort((a, b) => a.start - b.start);
}

export function generateMarkersCSV(analysis) {
  const markers = buildMarkers(analysis);
  const rows = [['Name', 'Start', 'Duration', 'Color', 'Comment']];
  for (const m of markers) {
    const dur = m.end - m.start;
    rows.push([
      `"${m.name.replace(/"/g, '""')}"`,
      toPremiereTC(m.start),
      toPremiereTC(dur),
      m.color,
      `"${m.comment.replace(/"/g, '""')}"`,
    ]);
  }
  return rows.map(r => r.join(',')).join('\n');
}

export function generateMarkersXML(analysis) {
  const markers = buildMarkers(analysis);

  const colorMap = {
    Red: 'FF0000', Orange: 'FF8000', Yellow: 'FFFF00',
    Blue: '0000FF', Green: '00FF00', Cyan: '00FFFF', Purple: '8000FF',
  };

  const markerXml = markers.map(m => `      <marker>
        <comment>${escapeXml(m.name)}</comment>
        <name>${escapeXml(m.name)}</name>
        <in>${m.start}</in>
        <out>${m.end}</out>
        <color>
          <alpha>FF</alpha>
          <red>${colorMap[m.color]?.slice(0,2) || 'FF'}</red>
          <green>${colorMap[m.color]?.slice(2,4) || '00'}</green>
          <blue>${colorMap[m.color]?.slice(4,6) || '00'}</blue>
        </color>
      </marker>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence>
    <markers>
${markerXml}
    </markers>
  </sequence>
</xmeml>`;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
