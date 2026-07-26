import { useMemo } from 'react';
import { useApp } from '../../state/AppContext';
import { TIME_BUCKETS } from '../../lib/dates';
import { matchesQuery } from '../../lib/derived';
import { sortRatings } from './filterSummary';

// Shared computed filter option lists - both the desktop FilterBar (one
// dropdown per filter) and the mobile consolidated filters panel (one
// stacked panel) render from the same data, so this lives in one place.
export function useFilterOptions() {
  const { state, dispatch, shows, days } = useApp();

  const dayKeys = useMemo(() => days.map((d) => d.key), [days]);
  const dayLabelFor = (key: string) => days.find((d) => d.key === key)?.label.toUpperCase() ?? key;

  const timeKeys = useMemo(() => TIME_BUCKETS.map((b) => b.key), []);
  const timeLabelFor = (key: string) => TIME_BUCKETS.find((b) => b.key === key)?.label ?? key;

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

  const showsSorted = useMemo(() => [...shows].sort((a, b) => a.title.localeCompare(b.title)), [shows]);
  const showsMatching = useMemo(
    () => showsSorted.filter((s) => matchesQuery(s, state.query)),
    [showsSorted, state.query],
  );
  const includedCount = shows.filter((s) => !state.excluded[s.id]).length;

  function resetAll() {
    dispatch({ type: 'RESET_ALL_FILTERS', days: dayKeys, venues: venueKeys, ratings: ratingKeys });
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
    venues,
    venueKeys,
    ratings,
    ratingKeys,
    showsSorted,
    showsMatching,
    includedCount,
    resetAll,
  };
}
