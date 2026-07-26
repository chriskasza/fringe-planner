import { describe, expect, it } from 'vitest';
import { TIME_BUCKETS, timeBucket } from './dates';
import { shows } from './loadData';

describe('time-of-day buckets', () => {
  const at = (h: number, m = 0) => h * 60 + m;

  it('splits at 5pm and 8pm', () => {
    expect(timeBucket(at(10, 30))).toBe('matinee');
    expect(timeBucket(at(16, 59))).toBe('matinee');
    expect(timeBucket(at(17))).toBe('evening');
    expect(timeBucket(at(19, 45))).toBe('evening');
    expect(timeBucket(at(20))).toBe('night');
    expect(timeBucket(at(21, 30))).toBe('night');
  });

  it('divides the real festival into three usefully-sized groups', () => {
    // The boundaries are fitted to the actual 2026 showtimes rather than
    // guessed - this pins that they still split the festival sensibly if the
    // data is re-scraped. The earlier four-bucket split had a "morning"
    // holding 5 performances and labelled 8pm - the single busiest slot -
    // as "late night".
    const counts = { matinee: 0, evening: 0, night: 0 };
    for (const s of shows) {
      for (const p of s.perfs) {
        if (p.status !== 'active') continue;
        counts[timeBucket(p.start)]++;
      }
    }

    const total = counts.matinee + counts.evening + counts.night;
    expect(total).toBe(282);
    // No bucket should be a rounding error or swallow everything.
    for (const key of TIME_BUCKETS.map((b) => b.key)) {
      expect(counts[key] / total).toBeGreaterThan(0.15);
      expect(counts[key] / total).toBeLessThan(0.6);
    }
  });

  it('labels each bucket with its own boundary so the filter needs no legend', () => {
    expect(TIME_BUCKETS.map((b) => b.label)).toEqual([
      'MATINEE · BEFORE 5PM',
      'EVENING · 5–8PM',
      'NIGHT · 8PM ON',
    ]);
  });
});
