import { useEffect } from 'react';
import { TIME_BUCKETS } from '../../lib/dates';
import type { MenuKey } from '../../lib/types';
import { FilterButton } from '../ui/FilterButton';
import { Dropdown } from '../ui/Dropdown';
import { CheckboxRow } from '../ui/CheckboxRow';
import { SegmentedControl } from '../ui/SegmentedControl';
import { summarizeCount, summarizeLabelled, summarizeSelected } from './filterSummary';
import { useFilterOptions } from './useFilterOptions';
import { useOverflowFilters } from './useOverflowFilters';
import { MoreFiltersButton } from './FiltersOverflowModal';
import styles from './FilterBar.module.css';
import dropdownStyles from '../ui/Dropdown.module.css';

type FilterBarProps = {
  view: 'grid' | 'cards';
  visibleCount?: number;
  countLabel?: string; // e.g. "SHOWN" - omit to render without a summary
};

export function FilterBar({ view, visibleCount, countLabel }: FilterBarProps) {
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
  // into "More...". Conflicts and Reset All are never part of this list -
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
                  <input
                    type="checkbox"
                    checked={!state.excluded[s.id]}
                    onChange={() => dispatch({ type: 'SET_EXCLUDED', showId: s.id, excluded: !state.excluded[s.id] })}
                  />
                  <span className={styles['filter-bar__show-info']}>
                    <span className={styles['filter-bar__show-title']}>{s.title}</span>
                    <span className={styles['filter-bar__show-meta']}>
                      {s.perfs.filter((p) => p.status === 'active').length} PERFS · {s.venueShort}
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
            label="Age & content"
            value={summarizeCount(state.ratingsOn, ratingKeys)}
            active={ratingKeys.some((k) => !state.ratingsOn[k])}
            onClick={() => toggleMenu('age')}
          />
          <Dropdown open={openMenu === 'age'} title="Age & content" width={220} onClose={() => dispatch({ type: 'CLOSE_MENUS' })}>
            <div className={dropdownStyles['dropdown__list']} style={{ maxHeight: 224, overflowY: 'auto' }}>
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
          label="Conflicts"
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

  // Outside-click closes this bar's own dropdowns. Two things it must not do:
  //
  // - run when nothing is open, which dispatched CLOSE_MENUS on every click
  //   anywhere in the app and re-rendered both view trees for nothing;
  // - touch the overflow modal ('all'). Desktop and mobile are both always
  //   mounted and switched by CSS alone, so this listener is live at phone
  //   widths too - and the modal renders outside this container, so every
  //   tap inside it counted as an outside click and unmounted the modal
  //   during mousedown, before the tap could reach the control under it. The
  //   modal closes itself via its backdrop, close button and Escape.
  useEffect(() => {
    if (!openMenu || openMenu === 'all') return;

    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        dispatch({ type: 'CLOSE_MENUS' });
      }
    }
    document.addEventListener('mousedown', onMouseDown, true);
    return () => document.removeEventListener('mousedown', onMouseDown, true);
  }, [containerRef, dispatch, openMenu]);

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

      {countLabel && (
        <div className={styles['filter-bar__right']} data-overflow-reserved>
          <span className={styles['filter-bar__summary']}>
            {visibleCount} {countLabel}
          </span>
        </div>
      )}
    </div>
  );
}
