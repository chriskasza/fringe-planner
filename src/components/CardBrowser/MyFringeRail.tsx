import { useApp } from '../../state/AppContext';
import { overlapping, perfInFilter, pickedList, type PickedEntry } from '../../lib/derived';
import { formatTime } from '../../lib/dates';
import './MyFringeRail.css';

export function MyFringeRail() {
  const { state, dispatch, shows, days } = useApp();
  const entries = pickedList(state.picked, shows);

  const byDay = new Map<string, PickedEntry[]>();
  for (const entry of entries) {
    const list = byDay.get(entry.perf.day) ?? [];
    list.push(entry);
    byDay.set(entry.perf.day, list);
  }

  const orderedDayKeys = days.map((d) => d.key).filter((k) => byDay.has(k));
  const totalOverlaps = entries.filter((e) => overlapping(e.key, state.picked, shows)).length;

  return (
    <div className="my-fringe-rail">
      <div className="my-fringe-rail__header">
        <span className="my-fringe-rail__title">MY FRINGE</span>
        <span className="my-fringe-rail__count">{state.picked.size} PICKED</span>
      </div>

      <div className="my-fringe-rail__body">
        {orderedDayKeys.length === 0 && (
          <div className="my-fringe-rail__empty">No shows picked yet. Star a show to add it here.</div>
        )}
        {orderedDayKeys.map((dayKey) => {
          const dayEntries = [...(byDay.get(dayKey) ?? [])].sort((a, b) => a.perf.start - b.perf.start);
          const day = days.find((d) => d.key === dayKey);
          const dayOverlaps = dayEntries.filter((e) => overlapping(e.key, state.picked, shows)).length;

          return (
            <div className="my-fringe-rail__group" key={dayKey}>
              <div className="my-fringe-rail__group-header">
                <span className="my-fringe-rail__day-label">{day?.label.toUpperCase() ?? dayKey}</span>
                <span
                  className={`my-fringe-rail__badge ${dayOverlaps > 0 ? 'my-fringe-rail__badge--overlap' : 'my-fringe-rail__badge--clear'}`}
                >
                  {dayOverlaps > 0 ? `${dayOverlaps} OVERLAP` : 'CLEAR'}
                </span>
              </div>
              {dayEntries.map((entry) => {
                const isOverlap = overlapping(entry.key, state.picked, shows);
                const isOutsideFilter = !perfInFilter(entry.perf, state.daysOn, state.timeBucketsOn);
                return (
                  <div
                    key={entry.key}
                    className={`my-fringe-rail__row ${isOverlap ? 'my-fringe-rail__row--overlap' : ''} ${isOutsideFilter ? 'my-fringe-rail__row--outside' : ''}`}
                  >
                    <span className="my-fringe-rail__time">{formatTime(entry.perf.start)}</span>
                    <span className="my-fringe-rail__info">
                      <span className="my-fringe-rail__row-title">{entry.show.title}</span>
                      <span className="my-fringe-rail__row-venue">{entry.show.venueShort}</span>
                      {isOutsideFilter && <span className="my-fringe-rail__outside-tag">OUTSIDE DATE FILTER</span>}
                    </span>
                    <button
                      type="button"
                      className="my-fringe-rail__remove"
                      onClick={() => dispatch({ type: 'TOGGLE_PICK', key: entry.key })}
                      aria-label={`Remove ${entry.show.title} from My Fringe`}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="my-fringe-rail__footer">
        <button type="button" className="my-fringe-rail__tickets">
          Get tickets · {state.picked.size}
        </button>
        <button
          type="button"
          className="my-fringe-rail__sync"
          onClick={() => dispatch({ type: 'SET_SYNC_OPEN', open: true })}
        >
          SYNC TO ANOTHER DEVICE ↗
        </button>
        <div className="my-fringe-rail__overlap-summary">
          {totalOverlaps > 0 ? `${totalOverlaps} PERFORMANCE${totalOverlaps > 1 ? 'S' : ''} OVERLAP` : 'NO OVERLAPS'}
        </div>
      </div>
    </div>
  );
}
