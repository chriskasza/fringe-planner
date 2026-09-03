import { useMemo } from 'react';
import { useApp } from '../../state/AppContext';
import { TIME_BUCKETS, timeBucket } from '../../lib/dates';
import { matchesQuery, notCancelled } from '../../lib/derived';
import type { TimeBucket } from '../../lib/types';
import { sortRatings } from './filterSummary';

// Shared computed filter option lists - both the desktop FilterBar (one
// dropdown per filter) and the mobile consolidated filters panel (one
// stacked panel) render from the same data, so this lives in one place.
export function useFilterOptions() {
  const { state, dispatch, shows, days } = useApp();

  const dayKeys = useMemo(() => days.map((d) => d.key), [days]);
  const dayLabelFor = (key: string) => days.find((d) => d.key === key)?.label.toUpperCase() ?? key;

  const timeKeys = useMemo(() => TIME_BUCKETS.map((b) => b.key), []);
  // Short form: this feeds the filter button's summary, not the panel rows.
  const timeLabelFor = (key: string) => TIME_BUCKETS.find((b) => b.key === key)?.short ?? key;

  // Performances (not shows) per bucket - a show can span buckets, and the
  // count is there to show how the festival is distributed across the day.
  const timeCounts = useMemo(() => {
    const counts = new Map<TimeBucket, number>();
    for (const s of shows) {
      for (const p of s.perfs) {
        if (!notCancelled(p)) continue;
        const b = timeBucket(p.start);
        counts.set(b, (counts.get(b) ?? 0) + 1);
      }
    }
    return counts;
  }, [shows]);

  const venues = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of shows) counts.set(s.venue, (counts.get(s.venue) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [shows]);
  const venueKeys = useMemo(() => venues.map(([v]) => v), [venues]);

  const ratings = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of shows) counts.set(s.rating, (counts.get(s.rating) ?? 0) + 1);
    return sortRatings([...counts.keys()]).map((r) => [r, counts.get(r) ?? 0] as const);
  }, [shows]);
  const ratingKeys = useMemo(() => ratings.map(([r]) => r), [ratings]);

  const warnings = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of shows) for (const w of s.warningTags) counts.set(w, (counts.get(w) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [shows]);
  const warningKeys = useMemo(() => warnings.map(([w]) => w), [warnings]);

  const showsSorted = useMemo(() => [...shows].sort((a, b) => a.title.localeCompare(b.title)), [shows]);
  const showsMatching = useMemo(
    () => showsSorted.filter((s) => matchesQuery(s, state.query)),
    [showsSorted, state.query],
  );
  const includedCount = shows.filter((s) => !state.excluded[s.id]).length;

  function resetAll() {
    dispatch({
      type: 'RESET_ALL_FILTERS',
      days: dayKeys,
      venues: venueKeys,
      ratings: ratingKeys,
      warnings: warningKeys,
    });
  }

  return {
    state,
    dispatch,
    shows,
    days,
    dayKeys,
    dayLabelFor,
    timeKeys,
    timeLabelFor,
    timeCounts,
    venues,
    venueKeys,
    ratings,
    ratingKeys,
    warnings,
    warningKeys,
    showsSorted,
    showsMatching,
    includedCount,
    resetAll,
  };
}
