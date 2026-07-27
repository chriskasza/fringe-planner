import { useEffect } from 'react';
import { TIME_BUCKETS } from '../../lib/dates';
import { CheckboxRow } from '../ui/CheckboxRow';
import { SegmentedControl } from '../ui/SegmentedControl';
import { activeFilterCount, summarizeCount, summarizeLabelled, summarizeSelected } from './filterSummary';
import { useFilterOptions } from './useFilterOptions';
import './MobileFiltersPanel.css';

type MobileFiltersPanelProps = {
  view: 'grid' | 'cards';
};

export function MobileFiltersButton({ view }: MobileFiltersPanelProps) {
  const { state, dispatch } = useFilterOptions();
  const count = activeFilterCount(state);

  return (
    <button
      type="button"
      className="mobile-filters-button"
      onClick={() => dispatch({ type: 'SET_OPEN_MENU', view, menu: 'all' })}
    >
      Filters{count > 0 ? ` · ${count}` : ''}
    </button>
  );
}

export function MobileFiltersPanel({ view }: MobileFiltersPanelProps) {
  const {
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
    showsMatching,
    includedCount,
    resetAll,
  } = useFilterOptions();

  const open = state.openMenu[view] === 'all';
  const close = () => dispatch({ type: 'CLOSE_MENUS' });

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div className="mobile-filters-overlay">
      <button type="button" className="mobile-filters-backdrop" aria-label="Close filters" onClick={close} />
      <div className="mobile-filters-sheet" role="dialog" aria-label="Filters">
        <div className="mobile-filters-sheet__header">
          <span className="mobile-filters-sheet__title">FILTERS</span>
          <button type="button" className="mobile-filters-sheet__close" onClick={close} aria-label="Close filters">
            ×
          </button>
        </div>

        <div className="mobile-filters-sheet__body">
          <section className="mobile-filters-section">
            <div className="mobile-filters-section__header">
              <span className="mobile-filters-section__label">Day</span>
              <span className="mobile-filters-section__value">{summarizeLabelled(state.daysOn, dayKeys, dayLabelFor)}</span>
            </div>
            <div className="mobile-filters-section__list">
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
            <div className="mobile-filters-section__footer">
              <button className="dropdown__footer-btn" onClick={() => dispatch({ type: 'SET_ALL_DAYS', days: dayKeys, on: true })}>
                All days
              </button>
              <button className="dropdown__footer-btn" onClick={() => dispatch({ type: 'SET_ALL_DAYS', days: dayKeys, on: false })}>
                Clear
              </button>
            </div>
          </section>

          <section className="mobile-filters-section">
            <div className="mobile-filters-section__header">
              <span className="mobile-filters-section__label">Time</span>
              <span className="mobile-filters-section__value">
                {summarizeLabelled(state.timeBucketsOn, timeKeys, timeLabelFor)}
              </span>
            </div>
            <div className="mobile-filters-section__list">
              {TIME_BUCKETS.map((b) => (
                <CheckboxRow
                  key={b.key}
                  label={b.label}
                  count={timeCounts.get(b.key) ?? 0}
                  checked={state.timeBucketsOn[b.key]}
                  onChange={() => dispatch({ type: 'SET_TIME_BUCKET_ON', bucket: b.key, on: !state.timeBucketsOn[b.key] })}
                />
              ))}
            </div>
            <div className="mobile-filters-section__footer">
              <button className="dropdown__footer-btn" onClick={() => dispatch({ type: 'SET_ALL_TIME_BUCKETS', on: true })}>
                Select all
              </button>
              <button className="dropdown__footer-btn" onClick={() => dispatch({ type: 'SET_ALL_TIME_BUCKETS', on: false })}>
                Deselect all
              </button>
            </div>
          </section>

          <section className="mobile-filters-section">
            <div className="mobile-filters-section__header">
              <span className="mobile-filters-section__label">Venue</span>
              <span className="mobile-filters-section__value">{summarizeCount(state.venuesOn, venueKeys)}</span>
            </div>
            <div className="mobile-filters-section__list">
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
            <div className="mobile-filters-section__footer">
              <button className="dropdown__footer-btn" onClick={() => dispatch({ type: 'SET_ALL_VENUES', venues: venueKeys, on: true })}>
                Select all
              </button>
              <button className="dropdown__footer-btn" onClick={() => dispatch({ type: 'SET_ALL_VENUES', venues: venueKeys, on: false })}>
                Deselect all
              </button>
            </div>
          </section>

          <section className="mobile-filters-section">
            <div className="mobile-filters-section__header">
              <span className="mobile-filters-section__label">Age &amp; content</span>
              <span className="mobile-filters-section__value">{summarizeCount(state.ratingsOn, ratingKeys)}</span>
            </div>
            <div className="mobile-filters-section__list">
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
            <div className="mobile-filters-section__footer">
              <button className="dropdown__footer-btn" onClick={() => dispatch({ type: 'SET_ALL_RATINGS', ratings: ratingKeys, on: true })}>
                Select all
              </button>
              <button className="dropdown__footer-btn" onClick={() => dispatch({ type: 'SET_ALL_RATINGS', ratings: ratingKeys, on: false })}>
                Deselect all
              </button>
            </div>
          </section>

          <section className="mobile-filters-section">
            <div className="mobile-filters-section__header">
              <span className="mobile-filters-section__label">Conflicts</span>
            </div>
            <SegmentedControl
              value={state.clash}
              onChange={(mode) => dispatch({ type: 'SET_CLASH', mode })}
              options={[
                { value: 'show', label: 'SHOW' },
                { value: 'hide', label: 'HIDE' },
              ]}
            />
          </section>

          <section className="mobile-filters-section">
            <div className="mobile-filters-section__header">
              <span className="mobile-filters-section__label">Shows</span>
              <span className="mobile-filters-section__value">
                {summarizeSelected(includedCount, shows.length)}
              </span>
            </div>
            <input
              className="filter-bar__typeahead"
              placeholder="Type to filter shows or venues…"
              value={state.query}
              onChange={(e) => dispatch({ type: 'SET_QUERY', query: e.target.value })}
            />
            <div className="mobile-filters-section__list">
              {showsMatching.length === 0 && (
                <div className="dropdown__empty">NO SHOWS MATCH &quot;{state.query}&quot;</div>
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
            <div className="mobile-filters-section__footer">
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
          </section>
        </div>

        <div className="mobile-filters-sheet__footer">
          <button type="button" className="mobile-filters-sheet__reset" onClick={resetAll}>
            RESET ALL
          </button>
        </div>
      </div>
    </div>
  );
}
