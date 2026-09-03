import { describe, expect, it } from 'vitest';
import { retireTime } from './merge.mjs';

// "Absent upstream" is ambiguous: the festival delists a performance both when
// it is cancelled and when it has simply been played. retireTime is the one
// place that choice is made, off the naive Halifax stamps the file already
// stores -- see the comment on the function itself.
describe('retireTime', () => {
  const NOW_LOCAL = '2026-09-02T22:56';
  const NOW = '2026-09-03T01:56:45.406Z';

  const active = (start) => ({
    timeId: 1, start, end: '2026-09-02T22:00', venue: 'Somewhere', status: 'active',
  });

  // The Halifax Fringe Sampler: one performance, Sep 2 19:00, gone from the pin
  // board by the 22:56 run. It played -- it was not cancelled.
  it('marks a performance that has already started as ended', () => {
    expect(retireTime(active('2026-09-02T19:00'), NOW_LOCAL, NOW)).toMatchObject({
      status: 'ended',
      endedAt: NOW,
    });
  });

  // A Horror Musical @ 2026-09-03T18:30, ~19h out when it vanished. The past-run
  // rule must not absorb a genuine cancellation.
  it('marks a performance still in the future as cancelled', () => {
    expect(retireTime(active('2026-09-03T18:30'), NOW_LOCAL, NOW)).toMatchObject({
      status: 'cancelled',
      cancelledAt: NOW,
    });
  });

  it('treats a performance starting exactly now as ended', () => {
    expect(retireTime(active(NOW_LOCAL), NOW_LOCAL, NOW).status).toBe('ended');
  });

  it('compares dates, not just clock times', () => {
    expect(retireTime(active('2026-09-13T09:00'), NOW_LOCAL, NOW).status).toBe('cancelled');
    expect(retireTime(active('2026-08-31T23:30'), NOW_LOCAL, NOW).status).toBe('ended');
  });

  // Idempotence is what keeps a re-run byte-identical: the second scrape of the
  // day must not restamp yesterday's retirements with a fresh `now`.
  it('returns an already-retired performance untouched', () => {
    for (const status of ['cancelled', 'ended']) {
      const done = { ...active('2026-09-02T19:00'), status, cancelledAt: 'earlier' };
      expect(retireTime(done, NOW_LOCAL, NOW)).toBe(done);
    }
  });
});
