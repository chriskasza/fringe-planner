import { useApp } from '../../state/AppContext';
import { perfInFilter, perfKey } from '../../lib/derived';
import { IconButton } from '../ui/IconButton';
import { DayRail } from './DayRail';
import { TimePills } from './TimePills';
import type { Show } from '../../lib/types';
import styles from './ShowCard.module.css';

export function ShowCard({ show }: { show: Show }) {
  const { state, dispatch } = useApp();

  const activePerfs = show.perfs.filter((p) => p.status === 'active');
  const pickedPerfs = activePerfs.filter((p) => state.picked.has(perfKey(show.id, p.day, p.start)));
  const outsideFilterCount = activePerfs.filter((p) => !perfInFilter(p, state.daysOn, state.timeBucketsOn)).length;
  const anyPicked = pickedPerfs.length > 0;
  const expanded = Boolean(state.expanded[show.id]);

  function toggleStar() {
    dispatch({ type: 'TOGGLE_SHOW_STAR', show });
  }

  return (
    <div data-testid="show-card" className={`${styles['show-card']} ${anyPicked ? styles['show-card--picked'] : ''}`}>
      <div className={styles['show-card__image']}>
        <span className={styles['show-card__image-label']}>[ SHOW IMAGE ]</span>
        <IconButton
          glyph={anyPicked ? '★' : '☆'}
          ariaLabel={anyPicked ? `Remove ${show.title} from My Fringe` : `Add all of ${show.title} to My Fringe`}
          variant={anyPicked ? 'star-picked' : 'star-unpicked'}
          size={28}
          onClick={toggleStar}
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
