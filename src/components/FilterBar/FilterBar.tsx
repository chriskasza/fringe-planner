import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { TIME_BUCKETS } from '../../lib/dates';
import { matchesQuery } from '../../lib/derived';
import type { MenuKey } from '../../lib/types';
import { FilterButton } from '../ui/FilterButton';
import { Dropdown } from '../ui/Dropdown';
import { CheckboxRow } from '../ui/CheckboxRow';
import { SegmentedControl } from '../ui/SegmentedControl';
import { summarizeCount, summarizeLabelled, sortRatings } from './filterSummary';
import './FilterBar.css';

type FilterBarProps = {
  view: 'grid' | 'cards';
  visibleCount: number;
  countLabel: string; // "ON THE GRID" | "SHOWN"
  rightExtra?: React.ReactNode;
};

export function FilterBar({ view, visibleCount, countLabel, rightExtra }: FilterBarProps) {
  const { state, dispatch, shows, days } = useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const [showsQuery, setShowsQuery] = useState('');

  const openMenu = state.openMenu[view];

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        dispatch({ type: 'CLOSE_MENUS' });
      }
    }
    document.addEventListener('mousedown', onMouseDown, true);
    return () => document.removeEventListener('mousedown', onMouseDown, true);
  }, [dispatch]);

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
    () => showsSorted.filter((s) => matchesQuery(s, showsQuery)),
    [showsSorted, showsQuery],
  );
  const includedCount = shows.filter((s) => !state.excluded[s.id]).length;

  function toggleMenu(menu: MenuKey) {
    dispatch({ type: 'SET_OPEN_MENU', view, menu: openMenu === menu ? null : menu });
  }

  function resetAll() {
    dispatch({ type: 'RESET_ALL_FILTERS', days: dayKeys, venues: venueKeys, ratings: ratingKeys });
    setShowsQuery('');
  }

  return (
    <div className="filter-bar" ref={containerRef} data-filter-menu>
      <span className="filter-bar__label">FILTER</span>

      <div className="filter-bar__item">
        <FilterButton
          label="Day"
          value={summarizeLabelled(state.daysOn, dayKeys, dayLabelFor)}
          active={dayKeys.some((k) => !state.daysOn[k])}
          onClick={() => toggleMenu('day')}
        />
        <Dropdown open={openMenu === 'day'} title="Day" width={240} onClose={() => dispatch({ type: 'CLOSE_MENUS' })}>
          <div className="dropdown__list" style={{ maxHeight: 230 }}>
            {days.map((d) => (
              <CheckboxRow
                key={d.key}
                label={d.label}
                count={d.count}
                checked={state.daysOn[d.key]}
                onChange={() => dispatch({ type: 'SET_DAY_ON', day: d.key, on: !state.daysOn[d.key] })}
              />
            ))}
          </div>
          <div className="dropdown__footer">
            <button className="dropdown__footer-btn" onClick={() => dispatch({ type: 'SET_ALL_DAYS', days: dayKeys, on: true })}>
              All days
            </button>
            <button className="dropdown__footer-btn" onClick={() => dispatch({ type: 'SET_ALL_DAYS', days: dayKeys, on: false })}>
              Clear
            </button>
          </div>
        </Dropdown>
      </div>

      <div className="filter-bar__item">
        <FilterButton
          label="Time"
          value={summarizeLabelled(state.timeBucketsOn, timeKeys, timeLabelFor)}
          active={timeKeys.some((k) => !state.timeBucketsOn[k as keyof typeof state.timeBucketsOn])}
          onClick={() => toggleMenu('time')}
        />
        <Dropdown open={openMenu === 'time'} title="Time" width={220} onClose={() => dispatch({ type: 'CLOSE_MENUS' })}>
          <div className="dropdown__list">
            {TIME_BUCKETS.map((b) => (
              <CheckboxRow
                key={b.key}
                label={b.label}
                checked={state.timeBucketsOn[b.key]}
                onChange={() => dispatch({ type: 'SET_TIME_BUCKET_ON', bucket: b.key, on: !state.timeBucketsOn[b.key] })}
              />
            ))}
          </div>
          <div className="dropdown__footer">
            <button className="dropdown__footer-btn" onClick={() => dispatch({ type: 'SET_ALL_TIME_BUCKETS', on: true })}>
              Select all
            </button>
            <button className="dropdown__footer-btn" onClick={() => dispatch({ type: 'SET_ALL_TIME_BUCKETS', on: false })}>
              Deselect all
            </button>
          </div>
        </Dropdown>
      </div>

      <div className="filter-bar__item">
        <FilterButton
          label="Venue"
          value={summarizeCount(state.venuesOn, venueKeys)}
          active={venueKeys.some((k) => !state.venuesOn[k])}
          onClick={() => toggleMenu('venue')}
        />
        <Dropdown open={openMenu === 'venue'} title="Venue" width={260} onClose={() => dispatch({ type: 'CLOSE_MENUS' })}>
          <div className="dropdown__list" style={{ maxHeight: 232, overflowY: 'auto' }}>
            {venues.map(([venue, count]) => (
              <CheckboxRow
                key={venue}
                label={venue}
                count={count}
                checked={state.venuesOn[venue]}
                onChange={() => dispatch({ type: 'SET_VENUE_ON', venue, on: !state.venuesOn[venue] })}
              />
            ))}
          </div>
          <div className="dropdown__footer">
            <button className="dropdown__footer-btn" onClick={() => dispatch({ type: 'SET_ALL_VENUES', venues: venueKeys, on: true })}>
              Select all
            </button>
            <button className="dropdown__footer-btn" onClick={() => dispatch({ type: 'SET_ALL_VENUES', venues: venueKeys, on: false })}>
              Deselect all
            </button>
          </div>
        </Dropdown>
      </div>

      <div className="filter-bar__item">
        <FilterButton
          label="Age & content"
          value={summarizeCount(state.ratingsOn, ratingKeys)}
          active={ratingKeys.some((k) => !state.ratingsOn[k])}
          onClick={() => toggleMenu('age')}
        />
        <Dropdown open={openMenu === 'age'} title="Age & content" width={220} onClose={() => dispatch({ type: 'CLOSE_MENUS' })}>
          <div className="dropdown__list" style={{ maxHeight: 224, overflowY: 'auto' }}>
            {ratings.map(([rating, count]) => (
              <CheckboxRow
                key={rating}
                label={rating}
                count={count}
                checked={state.ratingsOn[rating]}
                onChange={() => dispatch({ type: 'SET_RATING_ON', rating, on: !state.ratingsOn[rating] })}
              />
            ))}
          </div>
          <div className="dropdown__footer">
            <button className="dropdown__footer-btn" onClick={() => dispatch({ type: 'SET_ALL_RATINGS', ratings: ratingKeys, on: true })}>
              Select all
            </button>
            <button className="dropdown__footer-btn" onClick={() => dispatch({ type: 'SET_ALL_RATINGS', ratings: ratingKeys, on: false })}>
              Deselect all
            </button>
          </div>
        </Dropdown>
      </div>

      <SegmentedControl
        label="Clashes"
        value={state.clash}
        onChange={(mode) => dispatch({ type: 'SET_CLASH', mode })}
        options={[
          { value: 'all', label: 'ALL' },
          { value: 'only', label: 'ONLY' },
          { value: 'hide', label: 'HIDE' },
        ]}
      />

      <div className="filter-bar__item">
        <FilterButton
          label="Shows"
          value={`${includedCount}/${shows.length}`}
          active={includedCount !== shows.length}
          onClick={() => toggleMenu('shows')}
        />
        <Dropdown open={openMenu === 'shows'} title="Shows" width={322} onClose={() => dispatch({ type: 'CLOSE_MENUS' })}>
          <input
            className="filter-bar__typeahead"
            placeholder="Type to filter shows, genres, venues…"
            value={showsQuery}
            onChange={(e) => setShowsQuery(e.target.value)}
          />
          <div className="filter-bar__shows-header">
            {includedCount}/{shows.length} ON
          </div>
          <div className="dropdown__list" style={{ maxHeight: 230, overflowY: 'auto' }}>
            {showsMatching.length === 0 && (
              <div className="dropdown__empty">NO SHOWS MATCH &quot;{showsQuery}&quot;</div>
            )}
            {showsMatching.map((s) => (
              <label
                key={s.id}
                className={`filter-bar__show-row ${state.excluded[s.id] ? 'filter-bar__show-row--off' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={!state.excluded[s.id]}
                  onChange={() => dispatch({ type: 'SET_EXCLUDED', showId: s.id, excluded: !state.excluded[s.id] })}
                />
                <span className="filter-bar__show-info">
                  <span className="filter-bar__show-title">{s.title}</span>
                  <span className="filter-bar__show-meta">
                    {s.perfs.filter((p) => p.status === 'active').length} PERFS · {s.venueShort}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <div className="dropdown__footer">
            <button
              className="dropdown__footer-btn"
              onClick={() => dispatch({ type: 'SET_ALL_EXCLUDED', showIds: showsMatching.map((s) => s.id), excluded: false })}
            >
              Select all
            </button>
            <button
              className="dropdown__footer-btn"
              onClick={() => dispatch({ type: 'SET_ALL_EXCLUDED', showIds: showsMatching.map((s) => s.id), excluded: true })}
            >
              Deselect all
            </button>
          </div>
        </Dropdown>
      </div>

      <button type="button" className="filter-bar__reset" onClick={resetAll}>
        RESET ALL
      </button>

      <div className="filter-bar__right">
        <span className="filter-bar__shared">⇄ SHARED WITH {view === 'grid' ? 'CARD BROWSER' : 'GRID PLANNER'}</span>
        <span className="filter-bar__summary">
          {visibleCount} {countLabel}
        </span>
        {rightExtra}
      </div>
    </div>
  );
}
