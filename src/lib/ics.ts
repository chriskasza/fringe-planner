import ical, { ICalCalendarMethod } from 'ical-generator';
import { addDays } from './dates';
import type { DayKey, Show } from './types';
import { notCancelled } from './derived';

const FESTIVAL_TZID = 'America/Halifax';

// A Date built from plain y/m/d/h/m integers (never parsed from a string -
// see CLAUDE.md) reads its own get* components back unchanged regardless of
// host timezone, so ical-generator - given `timezone` - writes them straight
// into a TZID-anchored DTSTART/DTEND with no conversion. Verified this holds
// even with the process TZ forced to a non-Halifax zone.
function toLocalDate(day: DayKey, minutes: number): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
}

// Build an RFC 5545 iCalendar file from the user's picked performances.
// Each entry is a VEVENT with DTSTART/DTEND as TZID-anchored local times
// (not UTC, since we only know the wall clock), a LOCATION pulled from the
// show's venue address, and a description linking back to the ticket page.
export function generateIcs(picks: { show: Show; perf: Show['perfs'][number] }[]): string {
  const cal = ical({ prodId: '-//Halifax Fringe Planner//EN', method: ICalCalendarMethod.PUBLISH });

  for (const { show, perf } of picks) {
    // Played performances are exported too - calendars handle past events
    // fine, and a schedule you can't look back on isn't a schedule. Only a
    // cancelled slot, which never happened, is skipped.
    if (!notCancelled(perf)) continue;

    // transform.ts encodes an end past midnight as `end += 1440`, so the end
    // minutes have to carry their day with them: subtracting 1440 while
    // keeping perf.day writes a DTEND 23 hours before its own DTSTART, which
    // calendars either reject or draw as a negative-duration event.
    const endDayOffset = Math.floor(perf.end / 1440);

    cal.createEvent({
      start: toLocalDate(perf.day, perf.start),
      end: toLocalDate(addDays(perf.day, endDayOffset), perf.end - endDayOffset * 1440),
      timezone: FESTIVAL_TZID,
      summary: show.title,
      location: show.venueAddress ? `${show.venue}, ${show.venueAddress}` : show.venue,
      description: `Rating: ${show.rating}\n${show.ticketUrl}`,
      id: `${show.id}-${perf.day}-${perf.start}`,
    });
  }

  return cal.toString();
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
