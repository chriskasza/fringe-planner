import { useEffect, useState } from 'react';
import { TIME_BUCKETS } from '../../lib/dates';
import { CheckboxRow } from '../ui/CheckboxRow';
import { SegmentedControl } from '../ui/SegmentedControl';
import { activeFilterCount, ratingOptionLabel, summarizeCount, summarizeLabelled, summarizeSelected } from './filterSummary';
import { useFilterOptions } from './useFilterOptions';
import styles from './FiltersOverflowModal.module.css';
// Reuses FilterBar's show-row/typeahead styling and Dropdown's list/footer/
// empty styling for the same checkbox-list-with-footer pattern both already
// use - see review-for-non-standard-patterns.md point 1/3: this only worked
// before CSS Modules because FilterBar.tsx (which imports both) also
// happens to be mounted, making the plain global CSS ambient everywhere.
import filterBarStyles from './FilterBar.module.css';
import dropdownStyles from '../ui/Dropdown.module.css';

type FiltersOverflowModalProps = {
  view: 'grid' | 'cards';
};

// Every section starts collapsed each time the sheet opens - it's local,
// ephemeral UI state (not persisted, not shared), which fits since the
// component already unmounts entirely on close (`if (!open) return null`
// below), so there's nothing to remember between opens anyway. Sections
// toggle independently rather than closing one another.
const SECTION_KEYS = ['venue', 'shows', 'time', 'day', 'age', 'content', 'overlaps'] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

function allSectionsClosed(): Record<SectionKey, boolean> {
  return Object.fromEntries(SECTION_KEYS.map((k) => [k, false])) as Record<SectionKey, boolean>;
}

// Trigger for the overflow modal - the single, universal way to reach every
// filter regardless of viewport width: on desktop when the priority list
// (see FilterBar) overflows the row, on phones when none of it fits inline
// at all. The badge counts every active filter app-wide, not just the ones
// currently collapsed - if it only counted hidden ones, resizing the window
// would change the number with no filter having actually changed.
export function MoreFiltersButton({ view }: FiltersOverflowModalProps) {
  const { state, dispatch } = useFilterOptions();
  const count = activeFilterCount(state);

  return (
    <button
      type="button"
      className={styles['filters-overflow-trigger']}
      onClick={() => dispatch({ type: 'SET_OPEN_MENU', view, menu: 'all' })}
    >
      More…{count > 0 ? ` (${count})` : ''}
    </button>
  );
}

export function FiltersOverflowModal({ view }: FiltersOverflowModalProps) {
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
    warnings,
    warningKeys,
    showsMatching,
    includedCount,
    resetAll,
  } = useFilterOptions();

  const open = state.openMenu[view] === 'all';
  const close = () => dispatch({ type: 'CLOSE_MENUS' });

  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>(allSectionsClosed);
  const toggleSection = (key: SectionKey) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // Reset to fully collapsed on every open, rather than carrying over
  // whatever was expanded the last time the sheet was shown - adjusted
  // during render (React's documented pattern for resetting state when a
  // prop changes) rather than in an effect, which would flash the old
  // sections open for one frame before the reset took effect.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOpenSections(allSectionsClosed());
  }

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
    <div data-testid="filters-overflow-overlay" className={styles['filters-overflow-overlay']}>
      <button
        type="button"
        data-testid="filters-overflow-backdrop"
        className={styles['filters-overflow-backdrop']}
        aria-label="Close filters"
        onClick={close}
      />
      <div className={styles['filters-overflow-sheet']} role="dialog" aria-label="Filters">
        <div className={styles['filters-overflow-sheet__header']}>
          <span className={styles['filters-overflow-sheet__title']}>FILTERS</span>
          <button
            type="button"
            className={styles['filters-overflow-sheet__close']}
            onClick={close}
            aria-label="Close filters"
          >
            ×
          </button>
        </div>

        <div className={styles['filters-overflow-sheet__body']}>
          <section className={styles['filters-overflow-section']}>
            <button
              type="button"
              className={styles['filters-overflow-section__header']}
              onClick={() => toggleSection('venue')}
              aria-expanded={openSections.venue}
              aria-controls="filters-overflow-panel-venue"
            >
              <span className={styles['filters-overflow-section__label']}>Venue</span>
              <span className={styles['filters-overflow-section__value']}>
                {summarizeCount(state.venuesOn, venueKeys)}
              </span>
              <span className={styles['filters-overflow-section__chevron']} aria-hidden="true">
                {openSections.venue ? '▲' : '▼'}
              </span>
            </button>
            {openSections.venue && (
              <div id="filters-overflow-panel-venue" className={styles['filters-overflow-section__body']}>
                <div className={styles['filters-overflow-section__list']}>
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
                <div className={styles['filters-overflow-section__footer']}>
                  <button
                    className={dropdownStyles['dropdown__footer-btn']}
                    onClick={() => dispatch({ type: 'SET_ALL_VENUES', venues: venueKeys, on: true })}
                  >
                    Select all
                  </button>
                  <button
                    className={dropdownStyles['dropdown__footer-btn']}
                    onClick={() => dispatch({ type: 'SET_ALL_VENUES', venues: venueKeys, on: false })}
                  >
                    Deselect all
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className={styles['filters-overflow-section']}>
            <button
              type="button"
              className={styles['filters-overflow-section__header']}
              onClick={() => toggleSection('shows')}
              aria-expanded={openSections.shows}
              aria-controls="filters-overflow-panel-shows"
            >
              <span className={styles['filters-overflow-section__label']}>Shows</span>
              <span className={styles['filters-overflow-section__value']}>
                {summarizeSelected(includedCount, shows.length)}
              </span>
              <span className={styles['filters-overflow-section__chevron']} aria-hidden="true">
                {openSections.shows ? '▲' : '▼'}
              </span>
            </button>
            {openSections.shows && (
              <div id="filters-overflow-panel-shows" className={styles['filters-overflow-section__body']}>
                <input
                  className={filterBarStyles['filter-bar__typeahead']}
                  placeholder="Type to filter shows or venues…"
                  value={state.query}
                  onChange={(e) => dispatch({ type: 'SET_QUERY', query: e.target.value })}
                />
                <div className={styles['filters-overflow-section__list']}>
                  {showsMatching.length === 0 && (
                    <div className={dropdownStyles['dropdown__empty']}>NO SHOWS MATCH &quot;{state.query}&quot;</div>
                  )}
                  {showsMatching.map((s) => (
                    <label
                      key={s.id}
                      className={`${filterBarStyles['filter-bar__show-row']} ${state.excluded[s.id] ? filterBarStyles['filter-bar__show-row--off'] : ''}`}
                    >
                      <span
                        className={`${filterBarStyles['filter-bar__show-checkbox']} ${!state.excluded[s.id] ? filterBarStyles['filter-bar__show-checkbox--checked'] : ''}`}
                        aria-hidden="true"
                      >
                        {!state.excluded[s.id] ? '✓' : ''}
                      </span>
                      <input
                        type="checkbox"
                        className={filterBarStyles['filter-bar__show-checkbox-input']}
                        checked={!state.excluded[s.id]}
                        onChange={() => dispatch({ type: 'SET_EXCLUDED', showId: s.id, excluded: !state.excluded[s.id] })}
                      />
                      <span className={filterBarStyles['filter-bar__show-info']}>
                        <span className={filterBarStyles['filter-bar__show-title']}>{s.title}</span>
                        <span className={filterBarStyles['filter-bar__show-meta']}>
                          {s.perfs.filter((p) => p.status === 'active').length} PERFS · {s.venueShort}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className={styles['filters-overflow-section__footer']}>
                  <button
                    className={dropdownStyles['dropdown__footer-btn']}
                    onClick={() => dispatch({ type: 'SET_ALL_EXCLUDED', showIds: showsMatching.map((s) => s.id), excluded: false })}
                  >
                    Select all
                  </button>
                  <button
                    className={dropdownStyles['dropdown__footer-btn']}
                    onClick={() => dispatch({ type: 'SET_ALL_EXCLUDED', showIds: showsMatching.map((s) => s.id), excluded: true })}
                  >
                    Deselect all
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className={styles['filters-overflow-section']}>
            <button
              type="button"
              className={styles['filters-overflow-section__header']}
              onClick={() => toggleSection('time')}
              aria-expanded={openSections.time}
              aria-controls="filters-overflow-panel-time"
            >
              <span className={styles['filters-overflow-section__label']}>Time</span>
              <span className={styles['filters-overflow-section__value']}>
                {summarizeLabelled(state.timeBucketsOn, timeKeys, timeLabelFor)}
              </span>
              <span className={styles['filters-overflow-section__chevron']} aria-hidden="true">
                {openSections.time ? '▲' : '▼'}
              </span>
            </button>
            {openSections.time && (
              <div id="filters-overflow-panel-time" className={styles['filters-overflow-section__body']}>
                <div className={styles['filters-overflow-section__list']}>
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
                <div className={styles['filters-overflow-section__footer']}>
                  <button className={dropdownStyles['dropdown__footer-btn']} onClick={() => dispatch({ type: 'SET_ALL_TIME_BUCKETS', on: true })}>
                    Select all
                  </button>
                  <button className={dropdownStyles['dropdown__footer-btn']} onClick={() => dispatch({ type: 'SET_ALL_TIME_BUCKETS', on: false })}>
                    Deselect all
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className={styles['filters-overflow-section']}>
            <button
              type="button"
              className={styles['filters-overflow-section__header']}
              onClick={() => toggleSection('day')}
              aria-expanded={openSections.day}
              aria-controls="filters-overflow-panel-day"
            >
              <span className={styles['filters-overflow-section__label']}>Day</span>
              <span className={styles['filters-overflow-section__value']}>
                {summarizeLabelled(state.daysOn, dayKeys, dayLabelFor)}
              </span>
              <span className={styles['filters-overflow-section__chevron']} aria-hidden="true">
                {openSections.day ? '▲' : '▼'}
              </span>
            </button>
            {openSections.day && (
              <div id="filters-overflow-panel-day" className={styles['filters-overflow-section__body']}>
                <div className={styles['filters-overflow-section__list']}>
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
                <div className={styles['filters-overflow-section__footer']}>
                  <button className={dropdownStyles['dropdown__footer-btn']} onClick={() => dispatch({ type: 'SET_ALL_DAYS', days: dayKeys, on: true })}>
                    All days
                  </button>
                  <button className={dropdownStyles['dropdown__footer-btn']} onClick={() => dispatch({ type: 'SET_ALL_DAYS', days: dayKeys, on: false })}>
                    Clear
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className={styles['filters-overflow-section']}>
            <button
              type="button"
              className={styles['filters-overflow-section__header']}
              onClick={() => toggleSection('age')}
              aria-expanded={openSections.age}
              aria-controls="filters-overflow-panel-age"
            >
              <span className={styles['filters-overflow-section__label']}>Age</span>
              <span className={styles['filters-overflow-section__value']}>
                {summarizeCount(state.ratingsOn, ratingKeys)}
              </span>
              <span className={styles['filters-overflow-section__chevron']} aria-hidden="true">
                {openSections.age ? '▲' : '▼'}
              </span>
            </button>
            {openSections.age && (
              <div id="filters-overflow-panel-age" className={styles['filters-overflow-section__body']}>
                <div className={styles['filters-overflow-section__list']}>
                  {ratings.map(([rating, count]) => (
                    <CheckboxRow
                      key={rating}
                      label={ratingOptionLabel(rating)}
                      count={count}
                      checked={state.ratingsOn[rating]}
                      onChange={() => dispatch({ type: 'SET_RATING_ON', rating, on: !state.ratingsOn[rating] })}
                    />
                  ))}
                </div>
                <div className={styles['filters-overflow-section__footer']}>
                  <button className={dropdownStyles['dropdown__footer-btn']} onClick={() => dispatch({ type: 'SET_ALL_RATINGS', ratings: ratingKeys, on: true })}>
                    Select all
                  </button>
                  <button className={dropdownStyles['dropdown__footer-btn']} onClick={() => dispatch({ type: 'SET_ALL_RATINGS', ratings: ratingKeys, on: false })}>
                    Deselect all
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className={styles['filters-overflow-section']}>
            <button
              type="button"
              className={styles['filters-overflow-section__header']}
              onClick={() => toggleSection('content')}
              aria-expanded={openSections.content}
              aria-controls="filters-overflow-panel-content"
            >
              <span className={styles['filters-overflow-section__label']}>Content</span>
              <span className={styles['filters-overflow-section__value']}>
                {summarizeCount(state.warningsOn, warningKeys)}
              </span>
              <span className={styles['filters-overflow-section__chevron']} aria-hidden="true">
                {openSections.content ? '▲' : '▼'}
              </span>
            </button>
            {openSections.content && (
              <div id="filters-overflow-panel-content" className={styles['filters-overflow-section__body']}>
                <div className={styles['filters-overflow-section__list']}>
                  {warnings.length === 0 && (
                    <div className={dropdownStyles['dropdown__empty']}>NO CONTENT WARNINGS</div>
                  )}
                  {warnings.map(([warning, count]) => (
                    <CheckboxRow
                      key={warning}
                      label={warning}
                      count={count}
                      checked={state.warningsOn[warning]}
                      onChange={() => dispatch({ type: 'SET_WARNING_ON', warning, on: !state.warningsOn[warning] })}
                    />
                  ))}
                </div>
                <div className={styles['filters-overflow-section__footer']}>
                  <button className={dropdownStyles['dropdown__footer-btn']} onClick={() => dispatch({ type: 'SET_ALL_WARNINGS', warnings: warningKeys, on: true })}>
                    Select all
                  </button>
                  <button className={dropdownStyles['dropdown__footer-btn']} onClick={() => dispatch({ type: 'SET_ALL_WARNINGS', warnings: warningKeys, on: false })}>
                    Deselect all
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className={styles['filters-overflow-section']}>
            <button
              type="button"
              className={styles['filters-overflow-section__header']}
              onClick={() => toggleSection('overlaps')}
              aria-expanded={openSections.overlaps}
              aria-controls="filters-overflow-panel-overlaps"
            >
              <span className={styles['filters-overflow-section__label']}>Overlaps</span>
              <span className={styles['filters-overflow-section__chevron']} aria-hidden="true">
                {openSections.overlaps ? '▲' : '▼'}
              </span>
            </button>
            {openSections.overlaps && (
              <div id="filters-overflow-panel-overlaps" className={styles['filters-overflow-section__body']}>
                <SegmentedControl
                  value={state.clash}
                  onChange={(mode) => dispatch({ type: 'SET_CLASH', mode })}
                  options={[
                    { value: 'show', label: 'SHOW' },
                    { value: 'hide', label: 'HIDE' },
                  ]}
                />
              </div>
            )}
          </section>
        </div>

        <div className={styles['filters-overflow-sheet__footer']}>
          <button type="button" className={styles['filters-overflow-sheet__reset']} onClick={resetAll}>
            RESET ALL
          </button>
        </div>
      </div>
    </div>
  );
}
