import { useEffect } from 'react';
import { TIME_BUCKETS } from '../../lib/dates';
import { notCancelled } from '../../lib/derived';
import type { MenuKey, SortMode } from '../../lib/types';
import { FilterButton } from '../ui/FilterButton';
import { Dropdown } from '../ui/Dropdown';
import { CheckboxRow } from '../ui/CheckboxRow';
import { RadioRow } from '../ui/RadioRow';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ratingOptionLabel, summarizeCount, summarizeLabelled, summarizeSelected } from './filterSummary';
import { useFilterOptions } from './useFilterOptions';
import { useOverflowFilters } from './useOverflowFilters';
import { MoreFiltersButton } from './FiltersOverflowModal';
import styles from './FilterBar.module.css';
import dropdownStyles from '../ui/Dropdown.module.css';

const SORT_OPTIONS: { value: SortMode; label: string; short: string }[] = [
  { value: 'random', label: 'Random', short: 'RANDOM' },
  { value: 'title', label: 'A–Z', short: 'A–Z' },
  { value: 'soonest', label: 'Soonest', short: 'SOONEST' },
];

type FilterBarProps = {
  view: 'grid' | 'cards';
};

export function FilterBar({ view }: FilterBarProps) {
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

  const openMenu = state.openMenu[view];

  function toggleMenu(menu: MenuKey) {
    dispatch({ type: 'SET_OPEN_MENU', view, menu: openMenu === menu ? null : menu });
  }

  // Priority order: the items most likely to be used come first, so they're
  // the ones still inline once narrower viewports start collapsing the tail
  // into "More...". Overlaps and Reset All are never part of this list -
  // they always render.
  const items = [
    {
      key: 'venue',
      render: () => (
        <>
          <FilterButton
            label="Venue"
            value={summarizeCount(state.venuesOn, venueKeys)}
            active={venueKeys.some((k) => !state.venuesOn[k])}
            onClick={() => toggleMenu('venue')}
          />
          <Dropdown open={openMenu === 'venue'} title="Venue" width={260} onClose={() => dispatch({ type: 'CLOSE_MENUS' })}>
            <div className={dropdownStyles['dropdown__list']} style={{ maxHeight: 232, overflowY: 'auto' }}>
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
            <div className={dropdownStyles['dropdown__footer']}>
              <button className={dropdownStyles['dropdown__footer-btn']} onClick={() => dispatch({ type: 'SET_ALL_VENUES', venues: venueKeys, on: true })}>
                Select all
              </button>
              <button className={dropdownStyles['dropdown__footer-btn']} onClick={() => dispatch({ type: 'SET_ALL_VENUES', venues: venueKeys, on: false })}>
                Deselect all
              </button>
            </div>
          </Dropdown>
        </>
      ),
    },
    {
      key: 'shows',
      render: () => (
        <>
          <FilterButton
            label="Shows"
            value={summarizeSelected(includedCount, shows.length)}
            active={includedCount !== shows.length}
            onClick={() => toggleMenu('shows')}
          />
          <Dropdown open={openMenu === 'shows'} title="Shows" width={322} onClose={() => dispatch({ type: 'CLOSE_MENUS' })}>
            <input
              className={styles['filter-bar__typeahead']}
              placeholder="Type to filter shows or venues…"
              value={state.query}
              onChange={(e) => dispatch({ type: 'SET_QUERY', query: e.target.value })}
            />
            <div className={styles['filter-bar__shows-header']}>
              {includedCount}/{shows.length} ON
            </div>
            <div className={dropdownStyles['dropdown__list']} style={{ maxHeight: 230, overflowY: 'auto' }}>
              {showsMatching.length === 0 && (
                <div className={dropdownStyles['dropdown__empty']}>NO SHOWS MATCH &quot;{state.query}&quot;</div>
              )}
              {showsMatching.map((s) => (
                <label
                  key={s.id}
                  className={`${styles['filter-bar__show-row']} ${state.excluded[s.id] ? styles['filter-bar__show-row--off'] : ''}`}
                >
                  <span
                    className={`${styles['filter-bar__show-checkbox']} ${!state.excluded[s.id] ? styles['filter-bar__show-checkbox--checked'] : ''}`}
                    aria-hidden="true"
                  >
                    {!state.excluded[s.id] ? '✓' : ''}
                  </span>
                  <input
                    type="checkbox"
                    className={styles['filter-bar__show-checkbox-input']}
                    checked={!state.excluded[s.id]}
                    onChange={() => dispatch({ type: 'SET_EXCLUDED', showId: s.id, excluded: !state.excluded[s.id] })}
                  />
                  <span className={styles['filter-bar__show-info']}>
                    <span className={styles['filter-bar__show-title']}>{s.title}</span>
                    <span className={styles['filter-bar__show-meta']}>
                      {s.perfs.filter(notCancelled).length} PERFS · {s.venueShort}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className={dropdownStyles['dropdown__footer']}>
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
          </Dropdown>
        </>
      ),
    },
    {
      key: 'time',
      render: () => (
        <>
          <FilterButton
            label="Time"
            value={summarizeLabelled(state.timeBucketsOn, timeKeys, timeLabelFor)}
            active={timeKeys.some((k) => !state.timeBucketsOn[k as keyof typeof state.timeBucketsOn])}
            onClick={() => toggleMenu('time')}
          />
          <Dropdown open={openMenu === 'time'} title="Time" width={220} onClose={() => dispatch({ type: 'CLOSE_MENUS' })}>
            <div className={dropdownStyles['dropdown__list']}>
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
            <div className={dropdownStyles['dropdown__footer']}>
              <button className={dropdownStyles['dropdown__footer-btn']} onClick={() => dispatch({ type: 'SET_ALL_TIME_BUCKETS', on: true })}>
                Select all
              </button>
              <button className={dropdownStyles['dropdown__footer-btn']} onClick={() => dispatch({ type: 'SET_ALL_TIME_BUCKETS', on: false })}>
                Deselect all
              </button>
            </div>
          </Dropdown>
        </>
      ),
    },
    {
      key: 'day',
      render: () => (
        <>
          <FilterButton
            label="Day"
            value={summarizeLabelled(state.daysOn, dayKeys, dayLabelFor)}
            active={dayKeys.some((k) => !state.daysOn[k])}
            onClick={() => toggleMenu('day')}
          />
          <Dropdown open={openMenu === 'day'} title="Day" width={240} onClose={() => dispatch({ type: 'CLOSE_MENUS' })}>
            <div className={dropdownStyles['dropdown__list']} style={{ maxHeight: 230 }}>
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
            <div className={dropdownStyles['dropdown__footer']}>
              <button className={dropdownStyles['dropdown__footer-btn']} onClick={() => dispatch({ type: 'SET_ALL_DAYS', days: dayKeys, on: true })}>
                All days
              </button>
              <button className={dropdownStyles['dropdown__footer-btn']} onClick={() => dispatch({ type: 'SET_ALL_DAYS', days: dayKeys, on: false })}>
                Clear
              </button>
            </div>
          </Dropdown>
        </>
      ),
    },
    {
      key: 'age',
      render: () => (
        <>
          <FilterButton
            label="Age"
            value={summarizeCount(state.ratingsOn, ratingKeys)}
            active={ratingKeys.some((k) => !state.ratingsOn[k])}
            onClick={() => toggleMenu('age')}
          />
          <Dropdown open={openMenu === 'age'} title="Age" width={220} onClose={() => dispatch({ type: 'CLOSE_MENUS' })}>
            <div className={dropdownStyles['dropdown__list']} style={{ maxHeight: 224, overflowY: 'auto' }}>
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
            <div className={dropdownStyles['dropdown__footer']}>
              <button className={dropdownStyles['dropdown__footer-btn']} onClick={() => dispatch({ type: 'SET_ALL_RATINGS', ratings: ratingKeys, on: true })}>
                Select all
              </button>
              <button className={dropdownStyles['dropdown__footer-btn']} onClick={() => dispatch({ type: 'SET_ALL_RATINGS', ratings: ratingKeys, on: false })}>
                Deselect all
              </button>
            </div>
          </Dropdown>
        </>
      ),
    },
    {
      key: 'content',
      render: () => (
        <>
          <FilterButton
            label="Content"
            value={summarizeCount(state.warningsOn, warningKeys)}
            active={warningKeys.some((k) => !state.warningsOn[k])}
            onClick={() => toggleMenu('content')}
          />
          <Dropdown open={openMenu === 'content'} title="Content" width={240} onClose={() => dispatch({ type: 'CLOSE_MENUS' })}>
            <div className={dropdownStyles['dropdown__list']} style={{ maxHeight: 224, overflowY: 'auto' }}>
              {warnings.length === 0 && <div className={dropdownStyles['dropdown__empty']}>NO CONTENT WARNINGS</div>}
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
            <div className={dropdownStyles['dropdown__footer']}>
              <button className={dropdownStyles['dropdown__footer-btn']} onClick={() => dispatch({ type: 'SET_ALL_WARNINGS', warnings: warningKeys, on: true })}>
                Select all
              </button>
              <button className={dropdownStyles['dropdown__footer-btn']} onClick={() => dispatch({ type: 'SET_ALL_WARNINGS', warnings: warningKeys, on: false })}>
                Deselect all
              </button>
            </div>
          </Dropdown>
        </>
      ),
    },
    {
      key: 'conflicts',
      render: () => (
        <SegmentedControl
          label="Overlaps"
          value={state.clash}
          onChange={(mode) => dispatch({ type: 'SET_CLASH', mode })}
          options={[
            { value: 'show', label: 'SHOW' },
            { value: 'hide', label: 'HIDE' },
          ]}
        />
      ),
    },
  ];

  const { containerRef, itemRef, visibleCount: inlineCount } = useOverflowFilters(items.length);

  // Outside-click closes this bar's own dropdowns. Scoped to "not inside the
  // open dropdown's own panel" (every Dropdown renders role="dialog", and
  // only one can be open app-wide) rather than "outside the whole bar" -
  // the bar container includes empty background between filter items, which
  // otherwise never counted as outside and left a dropdown open forever.
  // Two things this must not do:
  //
  // - run when nothing is open, which dispatched CLOSE_MENUS on every click
  //   anywhere in the app and re-rendered both view trees for nothing;
  // - touch the overflow modal ('all'). Desktop and mobile are both always
  //   mounted and switched by CSS alone, so this listener is live at phone
  //   widths too - the modal closes itself via its backdrop, close button
  //   and Escape.
  useEffect(() => {
    if (!openMenu || openMenu === 'all') return;

    function onMouseDown(e: MouseEvent) {
      if ((e.target as Element).closest?.('[role="dialog"]')) return;
      dispatch({ type: 'CLOSE_MENUS' });
    }
    document.addEventListener('mousedown', onMouseDown, true);
    return () => document.removeEventListener('mousedown', onMouseDown, true);
  }, [dispatch, openMenu]);

  return (
    <div className={styles['filter-bar']} ref={containerRef}>
      <span className={styles['filter-bar__label']} data-overflow-reserved>
        FILTER
      </span>

      {items.map((item, i) => (
        <div
          key={item.key}
          className={styles['filter-bar__item']}
          ref={itemRef(i)}
          style={i >= inlineCount ? { position: 'absolute', visibility: 'hidden', pointerEvents: 'none' } : undefined}
          aria-hidden={i >= inlineCount ? true : undefined}
        >
          {item.render()}
        </div>
      ))}

      {inlineCount < items.length && (
        <div data-overflow-reserved>
          <MoreFiltersButton view={view} />
        </div>
      )}

      <button type="button" className={styles['filter-bar__reset']} onClick={resetAll} data-overflow-reserved>
        RESET ALL
      </button>

      {view === 'cards' && (
        <div className={styles['filter-bar__item']} data-overflow-reserved>
          <FilterButton
            label="Sort"
            value={SORT_OPTIONS.find((o) => o.value === state.sort)!.short}
            active={state.sort !== 'random'}
            onClick={() => toggleMenu('sort')}
          />
          <Dropdown open={openMenu === 'sort'} title="Sort" width={160} onClose={() => dispatch({ type: 'CLOSE_MENUS' })}>
            <div className={dropdownStyles['dropdown__list']} role="menu">
              {SORT_OPTIONS.map((o) => (
                <RadioRow
                  key={o.value}
                  label={o.label}
                  selected={state.sort === o.value}
                  onSelect={() => {
                    dispatch({ type: 'SET_SORT', sort: o.value });
                    dispatch({ type: 'CLOSE_MENUS' });
                  }}
                />
              ))}
            </div>
          </Dropdown>
        </div>
      )}
    </div>
  );
}
