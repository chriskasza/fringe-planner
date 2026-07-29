import { useApp } from '../../state/AppContext';
import { overlapping, perfInFilter, pickedList, type PickedEntry } from '../../lib/derived';
import { formatTime } from '../../lib/dates';
import styles from './MyFringePanel.module.css';

export function MyFringePanel() {
  const { state, dispatch, shows, days } = useApp();
  if (!state.myFringeOpen) return null;

  const entries = pickedList(state.picked, shows);

  const byDay = new Map<string, PickedEntry[]>();
  for (const entry of entries) {
    const list = byDay.get(entry.perf.day) ?? [];
    list.push(entry);
    byDay.set(entry.perf.day, list);
  }

  const orderedDayKeys = days.map((d) => d.key).filter((k) => byDay.has(k));

  return (
    <div data-testid="my-fringe-panel" className={styles['my-fringe-panel']}>
      <div className={styles['my-fringe-panel__header']}>
        <div className={styles['my-fringe-panel__header-left']}>
          <span className={styles['my-fringe-panel__title']}>MY FRINGE</span>
          <span className={styles['my-fringe-panel__count']}>{state.picked.size} PICKED</span>
        </div>
        <button
          type="button"
          className={styles['my-fringe-panel__close']}
          onClick={() => dispatch({ type: 'SET_MY_FRINGE_OPEN', open: false })}
          aria-label="Close My Fringe"
        >
          ×
        </button>
      </div>

      <div className={styles['my-fringe-panel__body']}>
        {orderedDayKeys.length === 0 && (
          <div className={styles['my-fringe-panel__empty']}>No shows picked yet. Star a show to add it here.</div>
        )}
        {orderedDayKeys.map((dayKey) => {
          const dayEntries = [...(byDay.get(dayKey) ?? [])].sort((a, b) => a.perf.start - b.perf.start);
          const day = days.find((d) => d.key === dayKey);
          const dayOverlaps = dayEntries.filter((e) => overlapping(e.timeId, state.picked, shows)).length;

          return (
            <div className={styles['my-fringe-panel__group']} key={dayKey}>
              <div className={styles['my-fringe-panel__group-header']}>
                <span className={styles['my-fringe-panel__day-label']}>{day?.label ?? dayKey}</span>
                {dayOverlaps > 0 && (
                  <span className={`${styles['my-fringe-panel__badge']} ${styles['my-fringe-panel__badge--overlap']}`}>
                    {dayOverlaps} OVERLAP
                  </span>
                )}
              </div>
              {dayEntries.map((entry) => {
                const isOverlap = overlapping(entry.timeId, state.picked, shows);
                const isOutsideFilter = !perfInFilter(entry.perf, state.daysOn, state.timeBucketsOn);
                return (
                  <div
                    key={entry.timeId}
                    className={`${styles['my-fringe-panel__row']} ${isOverlap ? styles['my-fringe-panel__row--overlap'] : ''} ${isOutsideFilter ? styles['my-fringe-panel__row--outside'] : ''}`}
                  >
                    <div className={styles['my-fringe-panel__row-main']}>
                      <span className={styles['my-fringe-panel__time']}>{formatTime(entry.perf.start)}</span>
                      <span className={styles['my-fringe-panel__info']}>
                        <span className={styles['my-fringe-panel__row-title']}>{entry.show.title}</span>
                        <span className={styles['my-fringe-panel__row-venue']}>{entry.show.venueShort}</span>
                        {isOutsideFilter && (
                          <span className={styles['my-fringe-panel__outside-tag']}>OUTSIDE DATE FILTER</span>
                        )}
                      </span>
                    </div>
                    <div className={styles['my-fringe-panel__row-actions']}>
                      <a
                        className={styles['my-fringe-panel__row-tickets']}
                        href={entry.show.ticketUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Get tickets ↗
                      </a>
                      <button
                        type="button"
                        className={styles['my-fringe-panel__remove']}
                        onClick={() => dispatch({ type: 'TOGGLE_PICK', timeId: entry.timeId })}
                        aria-label={`Remove ${entry.show.title} from My Fringe`}
                      >
                        Remove ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className={styles['my-fringe-panel__footer']}>
        <button
          type="button"
          className={styles['my-fringe-panel__sync']}
          onClick={() => dispatch({ type: 'SET_SYNC_OPEN', open: true })}
        >
          SYNC TO ANOTHER DEVICE ↗
        </button>
      </div>
    </div>
  );
}
