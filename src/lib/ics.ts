import type { Show } from './types';

// Stable identifier for iCalendar UIDs - doesn't need to survive page reloads,
// just be unique within this export so a re-import can cross-reference.
const PID = 'fringe-selector';

const FESTIVAL_TZID = 'America/Halifax';

// Build an RFC 5545 iCalendar file from the user's picked performances.
// Each entry is a VEVENT with DTSTART/DTEND as TZID-anchored local times
// (not UTC, since we only know the wall clock), a LOCATION pulled from the
// show's venue address, and a description linking back to the ticket page.
export function generateIcs(picks: { show: Show; perf: Show['perfs'][number] }[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Halifax Fringe Show Selector//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const { show, perf } of picks) {
    if (perf.status !== 'active') continue;

    const startH = Math.floor(perf.start / 60);
    const startM = perf.start % 60;
    const endMins = perf.end >= 1440 ? perf.end - 1440 : perf.end;
    const endH = Math.floor(endMins / 60);
    const endMm = endMins % 60;

    const dtStart = perf.day.replace(/-/g, '') + 'T' + String(startH).padStart(2, '0') + String(startM).padStart(2, '0') + '00';
    const dtEnd = perf.day.replace(/-/g, '') + 'T' + String(endH).padStart(2, '0') + String(endMm).padStart(2, '0') + '00';

    const summary = `${show.title}`;
    const location = show.venueAddress ? `${show.venue}, ${show.venueAddress}` : show.venue;
    const description = `Rating: ${show.rating}\n${show.ticketUrl}`;

    lines.push(
      'BEGIN:VEVENT',
      `DTSTART;TZID=${FESTIVAL_TZID}:${dtStart}`,
      `DTEND;TZID=${FESTIVAL_TZID}:${dtEnd}`,
      `SUMMARY:${foldLine(summary)}`,
      `LOCATION:${foldLine(location)}`,
      `DESCRIPTION:${foldLine(description)}`,
      `UID:${PID}-${show.id}-${perf.day}-${perf.start}@halifaxfringe.show-selector`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

// RFC 5545 line folding: lines longer than 75 octets must be folded.
function foldLine(text: string): string {
  const escaped = text.replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
  if (escaped.length <= 75) return escaped;
  const result: string[] = [];
  for (let i = 0; i < escaped.length; i += 74) {
    result.push((i > 0 ? ' ' : '') + escaped.slice(i, i + 74));
  }
  return result.join('\r\n');
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
