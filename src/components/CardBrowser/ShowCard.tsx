import { useApp } from '../../state/AppContext';
import { perfInFilter } from '../../lib/derived';
import { IconButton } from '../ui/IconButton';
import { DayRail } from './DayRail';
import { TimePills } from './TimePills';
import type { Show } from '../../lib/types';
import styles from './ShowCard.module.css';

export function ShowCard({ show }: { show: Show }) {
  const { state, dispatch } = useApp();

  const activePerfs = show.perfs.filter((p) => p.status === 'active');
  const pickedPerfs = activePerfs.filter((p) => state.picked.has(p.timeId));
  const outsideFilterCount = activePerfs.filter((p) => !perfInFilter(p, state.daysOn, state.timeBucketsOn)).length;
  const anyPicked = pickedPerfs.length > 0;
  const expanded = Boolean(state.expanded[show.id]);

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
          onClick={() => dispatch({ type: 'SET_DETAIL', detail: { timeId: activePerfs[0].timeId } })}
          className={styles['show-card__icon']}
        />
      </div>

      <div className={styles['show-card__body']}>
        <h3 className={styles['show-card__title']}>{show.title}</h3>
        <div className={styles['show-card__credits']}>
          {show.credits[0] ?? 'Independent artist'} · {show.mins} MIN
        </div>
        <div className={styles['show-card__venue']}>{show.venueShort}</div>
        <div className={styles['show-card__rating']}>{show.rating}</div>
      </div>

      <div className={styles['show-card__footer']}>
        <div className={styles['show-card__summary']}>
          {activePerfs.length} PERFORMANCE{activePerfs.length === 1 ? '' : 'S'}
          {pickedPerfs.length > 0 && ` · ${pickedPerfs.length} PICKED`}
          {outsideFilterCount > 0 && ` · ${outsideFilterCount} OUTSIDE FILTER`}
        </div>

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
      </div>
    </div>
  );
}
