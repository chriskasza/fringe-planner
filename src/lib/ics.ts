import { addDays } from './dates';
import type { DayKey, Show } from './types';

// Stable identifier for iCalendar UIDs - doesn't need to survive page reloads,
// just be unique within this export so a re-import can cross-reference.
const PID = 'fringe-selector';

const FESTIVAL_TZID = 'America/Halifax';

// "2026-09-11" + 1170 -> "20260911T193000", the RFC 5545 local date-time form.
function stamp(day: DayKey, minutes: number): string {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${day.replace(/-/g, '')}T${hh}${mm}00`;
}

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

    // transform.ts encodes an end past midnight as `end += 1440`, so the end
    // minutes have to carry their day with them: subtracting 1440 while
    // keeping perf.day writes a DTEND 23 hours before its own DTSTART, which
    // calendars either reject or draw as a negative-duration event.
    const endDayOffset = Math.floor(perf.end / 1440);
    const dtStart = stamp(perf.day, perf.start);
    const dtEnd = stamp(addDays(perf.day, endDayOffset), perf.end - endDayOffset * 1440);

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
