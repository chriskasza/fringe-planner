import { useMemo } from 'react';
import { useApp } from '../../../state/AppContext';
import { perfKey, visible } from '../../../lib/derived';
import { formatTime } from '../../../lib/dates';
import { TimelineCard } from './TimelineCard';
import type { Show } from '../../../lib/types';
import '../GridPlanner.css';
import './GridPlannerMobile.css';

function countOff(map: Record<string, boolean>): number {
  return Object.values(map).filter((v) => v === false).length;
}

export function GridPlannerMobile() {
  const { state, dispatch, shows, days } = useApp();

  const activeFilterCount =
    countOff(state.daysOn) +
    countOff(state.venuesOn) +
    countOff(state.ratingsOn) +
    countOff(state.timeBucketsOn) +
    Object.values(state.excluded).filter(Boolean).length +
    (state.clash !== 'all' ? 1 : 0) +
    (state.query.trim() ? 1 : 0);

  const day = days.find((d) => d.key === state.gridDay);

  const slots = useMemo(() => {
    const map = new Map<number, { show: Show; perf: Show['perfs'][number] }[]>();
    for (const show of shows) {
      if (!visible(show, state, shows)) continue;
      for (const perf of show.perfs) {
        if (perf.status !== 'active' || perf.day !== state.gridDay) continue;
        const list = map.get(perf.start) ?? [];
        list.push({ show, perf });
        map.set(perf.start, list);
      }
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [shows, state]);

  const starredTonight = shows.reduce(
    (n, s) =>
      n +
      s.perfs.filter(
        (p) => p.status === 'active' && p.day === state.gridDay && state.picked.has(perfKey(s.id, p.day, p.start)),
      ).length,
    0,
  );

  return (
    <div className="grid-planner-mobile">
      <div className="gpm-topbar">
        <span className="gpm-topbar__day">{day?.dow} {day?.dateNum} SEP</span>
        <span className="gpm-topbar__filters">FILTERS · {activeFilterCount}</span>
      </div>

      <div className="gpm-daystrip">
        {days.map((d) => (
          <button
            key={d.key}
            type="button"
            className={`gpm-daystrip__tab ${state.gridDay === d.key ? 'gpm-daystrip__tab--selected' : ''}`}
            onClick={() => dispatch({ type: 'SET_GRID_DAY', day: d.key })}
          >
            <span className="gpm-daystrip__dow">{d.dow}</span>
            <span className="gpm-daystrip__num">{d.dateNum}</span>
          </button>
        ))}
      </div>

      <div className="gpm-timeline">
        {slots.length === 0 && <div className="grid-body__empty">No shows on this day match the current filters.</div>}
        {slots.map(([start, entries]) => (
          <div className="gpm-timeline__row" key={start}>
            <div className="gpm-timeline__gutter">{formatTime(start)}</div>
            <div className="gpm-timeline__cards">
              {entries.map(({ show, perf }) => (
                <TimelineCard key={`${show.id}-${perf.timeId}`} show={show} perf={perf} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="gpm-footer">
        <span className="gpm-footer__starred">{starredTonight} STARRED TONIGHT</span>
        <button
          type="button"
          className="gpm-footer__myfringe"
          onClick={() => dispatch({ type: 'SET_SYNC_OPEN', open: true })}
        >
          My Fringe
        </button>
      </div>
    </div>
  );
}
