import { useApp } from '../../state/AppContext';
import { notCancelled, perfInFilter } from '../../lib/derived';
import { IconButton } from '../ui/IconButton';
import { DayRail } from './DayRail';
import { TimePills } from './TimePills';
import type { Show } from '../../lib/types';
import styles from './ShowCard.module.css';

export function ShowCard({ show }: { show: Show }) {
  const { state, dispatch } = useApp();

  // Counts the show's whole run, played performances included - the summary
  // line and the pick count are a record of what you did as much as a menu of
  // what's left.
  const activePerfs = show.perfs.filter(notCancelled);
  const pickedPerfs = activePerfs.filter((p) => state.picked.has(p.timeId));
  const outsideFilterCount = activePerfs.filter((p) => !perfInFilter(p, state.daysOn, state.timeBucketsOn)).length;
  const anyPicked = pickedPerfs.length > 0;
  const expanded = Boolean(state.expanded[show.id]);
  const isThisShowOpen = state.detail != null && show.perfs.some((p) => p.timeId === state.detail!.timeId);

  // A cancelled show has no active perfs, so the ⓘ opens on a cancelled one
  // instead - perfIndex indexes every status precisely so that resolves, and
  // DetailPanel renders the cancelled variant off it.
  const detailPerf = activePerfs[0] ?? show.perfs[0];

  return (
    <div data-testid="show-card" className={`${styles['show-card']} ${anyPicked ? styles['show-card--picked'] : ''}`}>
      <div className={styles['show-card__image']}>
        {show.poster ? (
          <img src={show.poster} alt="" loading="lazy" className={styles['show-card__image-img']} />
        ) : (
          <span className={styles['show-card__image-label']}>[ SHOW IMAGE ]</span>
        )}
        <IconButton
          glyph="ⓘ"
          ariaLabel={`Details for ${show.title}`}
          variant="default"
          size={28}
          onClick={() => {
            if (!detailPerf) return;
            dispatch({ type: 'SET_DETAIL', detail: isThisShowOpen ? null : { timeId: detailPerf.timeId } });
          }}
          className={styles['show-card__icon']}
        />
      </div>

      <div className={styles['show-card__body']}>
        <h3 className={styles['show-card__title']}>{show.title}</h3>
        <div className={styles['show-card__credits']}>
          {show.credits[0] ?? 'Independent artist'} · {show.mins} min
        </div>
        <div className={styles['show-card__venue']}>{show.venueShort}</div>
        <div className={styles['show-card__rating']}>
          {show.rating}
          {show.freeAdmission && ' · FREE'}
        </div>
      </div>

      <div className={styles['show-card__footer']}>
        <div className={styles['show-card__summary']}>
          {show.cancelled ? (
            'CANCELLED · NO PERFORMANCES'
          ) : (
            <>
              {activePerfs.length} PERFORMANCE{activePerfs.length === 1 ? '' : 'S'}
              {pickedPerfs.length > 0 && ` · ${pickedPerfs.length} PICKED`}
              {outsideFilterCount > 0 && ` · ${outsideFilterCount} OUTSIDE FILTER`}
            </>
          )}
        </div>

        {/* Nothing left to pick, so the day rail, the toggle and the time pills
            would all render empty. Drop them rather than show empty chrome. */}
        {!show.cancelled && (
          <>
            <DayRail show={show} onExpand={() => dispatch({ type: 'TOGGLE_EXPANDED', showId: show.id })} />

            <button
              type="button"
              className={styles['show-card__toggle-times']}
              onClick={() => dispatch({ type: 'TOGGLE_EXPANDED', showId: show.id })}
              aria-expanded={expanded}
              aria-controls={expanded ? `times-${show.id}` : undefined}
            >
              {expanded ? 'HIDE TIMES ▲' : 'SHOW TIMES ▼'}
            </button>

            {expanded && <div id={`times-${show.id}`}><TimePills show={show} /></div>}
          </>
        )}
      </div>
    </div>
  );
}
